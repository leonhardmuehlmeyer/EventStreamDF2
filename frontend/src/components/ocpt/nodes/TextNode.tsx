import { useEffect, useRef, useState } from 'react';
import { Group } from '@visx/group';
import { HierarchyPointNode } from '@visx/hierarchy/lib/types';
import { ScaleOrdinal } from 'd3';

import * as Ocpt from '~/types/ocpt/ocpt.types';

interface TextNodeProps {
    width: number;
    height: number;
    colorScale: ScaleOrdinal<string, string, never>;
    isSilent: boolean;
    opacity: number;
    node: HierarchyPointNode<Ocpt.Node>;
    key: number;
    showDetails?: boolean;
    onMouseEnter?: (event: React.MouseEvent, node: HierarchyPointNode<Ocpt.Node>) => void;
    onMouseMove?: (event: React.MouseEvent, node: HierarchyPointNode<Ocpt.Node>) => void;
    onMouseLeave?: (event: React.MouseEvent, node: HierarchyPointNode<Ocpt.Node>) => void;
}

const getFillColor = (isSilent: boolean) => {
    if (isSilent) {
        return 'black';
    } else return 'white';
};

const TextNode: React.FC<TextNodeProps> = ({
    height,
    width,
    node,
    key,
    colorScale,
    isSilent,
    opacity,
    showDetails,
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
}) => {
    const activity = node.data.value as Ocpt.Activity;
    const fillColor = getFillColor(isSilent);
    const textContent = activity.activity;

    // Create a ref to measure text width
    const textRef = useRef<SVGTextElement>(null);
    const [nodeWidth, setNodeWidth] = useState(width);

    // Measure text after render
    useEffect(() => {
        if (textRef.current) {
            const bbox = textRef.current.getBBox();
            // Set node width based on text width with some padding
            setNodeWidth(Math.max(bbox.width + 20, width));
        }
    }, [textContent, width]);

    return (
        <Group
            top={node.y}
            left={node.x}
            key={key}
            className="cursor-pointer"
            fontFamily="Inter, Arial, sans-serif"
            onMouseEnter={(event) => onMouseEnter?.(event, node)}
            onMouseMove={(event) => onMouseMove?.(event, node)}
            onMouseLeave={(event) => onMouseLeave?.(event, node)}
        >
            <rect
                height={height}
                width={nodeWidth}
                y={-height / 2}
                x={-nodeWidth / 2}
                fill={fillColor}
                opacity={opacity}
                stroke="black"
                strokeWidth={2}
                rx={5}
            />
            <text
                ref={textRef}
                dy=".33em"
                textAnchor="middle"
                fill="black"
                style={{ pointerEvents: 'none' }}
                opacity={opacity}
            >
                {textContent}
            </text>
            {!isSilent && (() => {
                const size = 10;
                const gap = 4;
                const count = activity.ots.length;
                const startX = -(count * size + (count - 1) * gap) / 2;
                return activity.ots.map((ot, index) => (
                    <rect
                        key={index}
                        x={startX + index * (size + gap)}
                        y={height / 2 - size - 4}
                        width={size}
                        height={size}
                        fill={colorScale(ot.ot)}
                        opacity={opacity}
                    />
                ));
            })()}
            {showDetails && !isSilent && (() => {
                const rowHeight = 18;
                const rectSize = 10;
                const startY = height / 2 + 8;
                const leftX = -nodeWidth / 2 + 4;
                return activity.ots.map((ot, index) => (
                    <g key={`detail-${index}`} opacity={opacity}>
                        <rect
                            x={leftX}
                            y={startY + index * rowHeight}
                            width={rectSize}
                            height={rectSize}
                            fill={colorScale(ot.ot)}
                        />
                        <text
                            x={leftX + 14}
                            y={startY + index * rowHeight + rectSize / 2}
                            dy=".35em"
                            fill="black"
                            fontSize={11}
                        >
                            <tspan fontWeight={600}>{ot.ot}</tspan>
                            {ot.exhibits && (
                                <tspan dx={6} fontSize={10} fontWeight={400}>{ot.exhibits.join(' ')}</tspan>
                            )}
                        </text>
                    </g>
                ));
            })()}
        </Group>
    );
};

export default TextNode;
