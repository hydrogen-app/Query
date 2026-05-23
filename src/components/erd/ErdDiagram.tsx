import { useEffect, useMemo } from "react";
import * as React from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  MarkerType,
} from "@xyflow/react";
import dagre from "dagre";
import type { DatabaseSchema, ColumnInfo } from "../../types";
import { TableNode } from "./TableNode";
import "@xyflow/react/dist/style.css";

// Type for table node data
interface TableNodeData {
  label: string;
  columns: ColumnInfo[];
  expanded: boolean;
  onToggleExpand: (tableName: string) => void;
}

interface ErdDiagramProps {
  schema: DatabaseSchema | null;
}

// Layout configuration
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 250;
const nodeHeightBase = 40; // Header height
const nodeHeightPerColumn = 24; // Height per column row
const maxVisibleColumns = 10; // Max columns to show before "more..."

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: "TB", ranksep: 100, nodesep: 80 });

  nodes.forEach((node) => {
    // Calculate dynamic height based on number of columns and expansion state
    const data = node.data as unknown as TableNodeData;
    const totalColumns = data.columns?.length || 0;
    const isExpanded = data.expanded || false;

    let columnCount: number;
    let extraRow = 0;

    if (isExpanded) {
      // Show all columns when expanded
      columnCount = totalColumns;
    } else {
      // Show up to 10 columns when collapsed
      columnCount = Math.min(totalColumns, maxVisibleColumns);
      extraRow = totalColumns > maxVisibleColumns ? 1 : 0; // +1 for expand button
    }

    const height =
      nodeHeightBase + columnCount * nodeHeightPerColumn + extraRow * nodeHeightPerColumn;
    dagreGraph.setNode(node.id, { width: nodeWidth, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const data = node.data as unknown as TableNodeData;
    const totalColumns = data.columns?.length || 0;
    const isExpanded = data.expanded || false;

    let columnCount: number;
    let extraRow = 0;

    if (isExpanded) {
      columnCount = totalColumns;
    } else {
      columnCount = Math.min(totalColumns, maxVisibleColumns);
      extraRow = totalColumns > maxVisibleColumns ? 1 : 0;
    }

    const height =
      nodeHeightBase + columnCount * nodeHeightPerColumn + extraRow * nodeHeightPerColumn;
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - height / 2,
    };
  });

  return { nodes, edges };
};

// Define node types
const nodeTypes = {
  table: TableNode,
};

export function ErdDiagram({ schema }: ErdDiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set());

  // Memoize node types to prevent re-renders
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  // Handle node expansion toggle
  const handleToggleExpand = React.useCallback((tableName: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tableName)) {
        newSet.delete(tableName);
      } else {
        newSet.add(tableName);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    if (!schema || !schema.tables || schema.tables.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Create nodes from tables
    const newNodes: Node[] = schema.tables.map((table) => ({
      id: table.table_name,
      type: "table",
      data: {
        label: table.table_name,
        columns: table.columns,
        expanded: expandedNodes.has(table.table_name),
        onToggleExpand: handleToggleExpand,
      },
      position: { x: 0, y: 0 },
    }));

    // Create edges from foreign keys
    const newEdges: Edge[] = [];
    schema.tables.forEach((table) => {
      if (table.foreign_keys && table.foreign_keys.length > 0) {
        table.foreign_keys.forEach((fk) => {
          newEdges.push({
            id: `${fk.table_name}-${fk.column_name}-${fk.foreign_table_name}`,
            source: fk.table_name,
            target: fk.foreign_table_name,
            type: "smoothstep",
            animated: false,
            style: {
              stroke: "var(--primary)",
              strokeWidth: 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "var(--primary)",
              width: 20,
              height: 20,
            },
            label: `${fk.column_name} → ${fk.foreign_column_name}`,
            labelStyle: {
              fill: "var(--primary)",
              fontSize: 11,
              fontWeight: 500,
            },
            labelBgStyle: {
              fill: "var(--card)",
              fillOpacity: 0.9,
            },
          });
        });
      }
    });

    // Apply Dagre layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [schema, expandedNodes, handleToggleExpand, setNodes, setEdges]);

  if (!schema || !schema.tables || schema.tables.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium">No schema available</p>
          <p className="mt-2 text-sm">Connect to a database to view the ERD</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={memoizedNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
        }}
      >
        <Background
          color="var(--border)"
          gap={16}
          size={1}
          style={{ backgroundColor: "var(--background)" }}
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}
