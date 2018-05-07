import * as React from "react";

import * as globals from "../globals";
import { classNames } from "../utils";

import { Point } from "../../core";

import * as Hammer from "hammerjs";

export interface DraggableElementProps {
    className?: string;
    onTap?: () => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    dragData: () => any;
    renderDragElement?: () => [JSX.Element, Point];
}

export interface DraggableElementState {
    dragging: boolean;
}

export class DraggableElement extends React.Component<DraggableElementProps, DraggableElementState> {
    refs: {
        draggableContainer: Element;
    }

    constructor(props: DraggableElementProps) {
        super(props);
        this.state = { dragging: false };
    }

    public componentDidMount() {
        globals.dragController.registerDraggable(this, this.refs.draggableContainer, this.props.onTap);
    }

    public componentWillUnmount() {
        globals.dragController.unregisterDraggable(this);
    }

    public onDragStart() {
        this.setState({ dragging: true });
        if (this.props.onDragStart) this.props.onDragStart();
        return this.props.dragData();
    }

    public onDragEnd() {
        this.setState({ dragging: false });
        if (this.props.onDragEnd) this.props.onDragEnd();
    }

    public renderDragElement(): [JSX.Element, Point] {
        if (this.props.renderDragElement) {
            return this.props.renderDragElement();
        } else {
            return [<span>{this.props.children}</span>, { x: 0, y: 0 }];
        }
    }

    public render() {
        let additional_classes = this.state.dragging ? "draggable dragging" : "draggable";
        return (
            <span ref="draggableContainer"
                className={classNames(this.props.className, "draggable", ["dragging", this.state.dragging])}
                style={{ display: "inline-block", cursor: "pointer" }}
            >
                {this.props.children}
            </span>
        );
    }
}

export interface ClickableSVGElementProps {
    onClick?: () => void;
}

export class ClickableSVGElement extends React.Component<ClickableSVGElementProps, {}> {
    refs: {
        container: SVGGElement;
    }

    private hammer: HammerManager;

    public componentDidMount() {
        this.hammer = new Hammer(this.refs.container);
        this.hammer.add(new Hammer.Tap());
        this.hammer.on("tap", () => {
            if (this.props.onClick) {
                this.props.onClick();
            }
        });
    }

    public componentWillUnmount() {
        this.hammer.destroy();
        this.hammer = null;
    }

    public render() {
        return (
            <g ref="container" style={{ cursor: "pointer" }}>
                {this.props.children}
            </g>
        );
    }
}