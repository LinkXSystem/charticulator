import * as Graphics from "../../graphics";
import { Color, fillDefaults, Scale, deepClone } from "../../common";
import { Controls } from "../common";
import { Specification } from "../../index";

export let defaultAxisStyle: Specification.Types.AxisRenderingStyle = {
    tickColor: { r: 0, g: 0, b: 0 },
    lineColor: { r: 0, g: 0, b: 0 },
    fontFamily: "Arial",
    fontSize: 12,
    tickSize: 5
};

function fillDefaultAxisStyle(style?: Specification.Types.AxisRenderingStyle) {
    return fillDefaults(style, defaultAxisStyle);
}

export interface TickDescription {
    position: number;
    label: string;
}

// export function linearTicks(domainMin: number, domainMax: number, range: number): TickDescription[] {
//     let scale = new Scale.NumericalScale();
//     scale.domainMin = domainMin;
//     scale.domainMax = domainMax;
//     let ticks = scale.ticks(Math.round(Math.min(10, range / 20)));
//     let r: TickDescription[] = [];
//     for (let i = 0; i < ticks.length; i++) {
//         let tx = (ticks[i] - domainMin) / (domainMax - domainMin) * range;
//         r.push({
//             position: tx,
//             label: ticks[i].toFixed(0)
//         });
//     }
//     return r;
// }

// export function categoricalTicks(info: CategoricalAxisInfo, names: string[], range: number): TickDescription[] {
//     return names.map((name, index) => {
//         return {
//             position: (info.ranges[index][0] + info.ranges[index][1]) / 2 * range,
//             label: name
//         };
//     });
// }

export class AxisRenderer {
    ticks: TickDescription[] = [];
    style: Specification.Types.AxisRenderingStyle = defaultAxisStyle;
    rangeMin: number = 0;
    rangeMax: number = 1;
    valueToPosition: (value: any) => number;
    oppositeSide: boolean = false;

    private static textMeasurer = new Graphics.TextMeasurer();

    public setStyle(style?: Specification.Types.AxisRenderingStyle) {
        if (!style) {
            this.style = defaultAxisStyle;
        } else {
            this.style = fillDefaultAxisStyle(deepClone(style));
        }
        return this;
    }

    public setAxisDataBinding(data: Specification.Types.AxisDataBinding, rangeMin: number, rangeMax: number, enablePrePostGap: boolean = false) {
        this.rangeMin = rangeMin;
        this.rangeMax = rangeMax;

        if (!data) return this;
        this.setStyle(data.style);
        this.oppositeSide = data.side == "opposite";
        switch (data.type) {
            case "numerical": {
                this.setLinearScale(data.domainMin, data.domainMax, rangeMin, rangeMax);
            } break;
            case "categorical": {
                this.setCategoricalScale(data.categories, getCategoricalAxis(data, enablePrePostGap).ranges, rangeMin, rangeMax);
            } break;
            case "default": {

            } break;
        }
        return this;
    }

    ticksData: { tick: any, value: any }[];
    public setTicksByData(ticks: { tick: any, value: any }[]) {
        let position2Tick = new Map<number, string>();
        for (let tick of ticks) {
            let pos = this.valueToPosition(tick.value);
            position2Tick.set(pos, tick.tick as string);
        }
        this.ticks = [];
        for (let [pos, tick] of position2Tick.entries()) {
            this.ticks.push({
                position: pos,
                label: tick
            });
        }
    }

    public setLinearScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) {
        let scale = new Scale.NumericalScale();
        scale.domainMin = domainMin;
        scale.domainMax = domainMax;
        let rangeLength = Math.abs(rangeMax - rangeMin);
        let ticks = scale.ticks(Math.round(Math.min(10, rangeLength / 40)));
        let r: TickDescription[] = [];
        for (let i = 0; i < ticks.length; i++) {
            let tx = (ticks[i] - domainMin) / (domainMax - domainMin) * (rangeMax - rangeMin) + rangeMin;
            r.push({
                position: tx,
                label: ticks[i].toFixed(0)
            });
        }
        this.valueToPosition = (value) => (value - domainMin) / (domainMax - domainMin) * (rangeMax - rangeMin) + rangeMin;
        this.ticks = r;
        this.rangeMin = rangeMin;
        this.rangeMax = rangeMax;
        return this;
    }

    public setCategoricalScale(domain: string[], range: [number, number][], rangeMin: number, rangeMax: number) {
        let r: TickDescription[] = [];
        for (let i = 0; i < domain.length; i++) {
            r.push({
                position: (range[i][0] + range[i][1]) / 2 * (rangeMax - rangeMin) + rangeMin,
                label: domain[i]
            });
        }
        this.valueToPosition = (value) => {
            let i = domain.indexOf(value);
            if (i >= 0) {
                return (range[i][0] + range[i][1]) / 2 * (rangeMax - rangeMin) + rangeMin;
            } else {
                return 0;
            }
        };
        this.ticks = r;
        this.rangeMin = rangeMin;
        this.rangeMax = rangeMax;
        return this;
    }

    public renderLine(x: number, y: number, angle: number, side: number): Graphics.Group {
        let g = Graphics.makeGroup([]);
        let style = this.style;
        let rangeMin = this.rangeMin;
        let rangeMax = this.rangeMax;
        let tickSize = style.tickSize;
        let lineStyle: Graphics.Style = {
            strokeLinecap: "square",
            strokeColor: style.lineColor
        }
        AxisRenderer.textMeasurer.setFontFamily(style.fontFamily)
        AxisRenderer.textMeasurer.setFontSize(style.fontSize);
        if (this.oppositeSide) side = -side;

        let cos = Math.cos(angle / 180 * Math.PI);
        let sin = Math.sin(angle / 180 * Math.PI);
        let x1 = x + rangeMin * cos;
        let y1 = y + rangeMin * sin;
        let x2 = x + rangeMax * cos;
        let y2 = y + rangeMax * sin;
        // Base line
        g.elements.push(Graphics.makeLine(x1, y1, x2, y2, lineStyle));
        // Ticks
        for (let tickPosition of this.ticks.map(x => x.position).concat([rangeMin, rangeMax])) {
            let tx = x + tickPosition * cos, ty = y + tickPosition * sin;
            let dx = side * tickSize * sin, dy = -side * tickSize * cos;
            g.elements.push(Graphics.makeLine(tx, ty, tx + dx, ty + dy, lineStyle));
        }
        // Tick texts
        let ticks = this.ticks.map(x => {
            return {
                position: x.position,
                label: x.label,
                measure: AxisRenderer.textMeasurer.measure(x.label)
            };
        });
        let maxTextWidth = 0;
        let maxTickDistance = 0;
        for (let i = 0; i < ticks.length; i++) {
            maxTextWidth = Math.max(maxTextWidth, ticks[i].measure.width);
            if (i > 0) {
                maxTickDistance = Math.max(maxTickDistance, Math.abs(ticks[i - 1].position - ticks[i].position));
            }
        }
        for (let tick of ticks) {
            let tx = x + tick.position * cos, ty = y + tick.position * sin;
            let offset = 3;
            let dx = side * (tickSize + offset) * sin, dy = -side * (tickSize + offset) * cos;

            if (Math.abs(cos) < 0.5) { // 60 ~ 120 degree
                let [px, py] = Graphics.TextMeasurer.ComputeTextPosition(0, 0, tick.measure, side * sin < 0 ? "right" : "left", "middle", 0);
                let gText = Graphics.makeGroup([Graphics.makeText(px, py, tick.label, style.fontFamily, style.fontSize, { fillColor: style.tickColor })]);
                gText.transform = {
                    x: tx + dx,
                    y: ty + dy,
                    angle: 0
                };
                g.elements.push(gText);
            } else if (Math.abs(cos) < Math.sqrt(3) / 2) {
                let [px, py] = Graphics.TextMeasurer.ComputeTextPosition(0, 0, tick.measure, side * sin < 0 ? "right" : "left", "middle", 0);
                let gText = Graphics.makeGroup([Graphics.makeText(px, py, tick.label, style.fontFamily, style.fontSize, { fillColor: style.tickColor })]);
                gText.transform = {
                    x: tx + dx,
                    y: ty + dy,
                    angle: 0
                };
                g.elements.push(gText);
            } else {
                if (maxTextWidth > maxTickDistance) {
                    let [px, py] = Graphics.TextMeasurer.ComputeTextPosition(0, 0, tick.measure, side * cos > 0 ? "right" : "left", side * cos > 0 ? "top" : "bottom", 0);
                    let gText = Graphics.makeGroup([Graphics.makeText(px, py, tick.label, style.fontFamily, style.fontSize, { fillColor: style.tickColor })]);
                    gText.transform = {
                        x: tx + dx,
                        y: ty + dy,
                        angle: (cos > 0) ? 36 + angle : 36 + angle - 180
                    };
                    g.elements.push(gText);
                } else {
                    let [px, py] = Graphics.TextMeasurer.ComputeTextPosition(0, 0, tick.measure, "middle", side * cos > 0 ? "top" : "bottom", 0);
                    let gText = Graphics.makeGroup([Graphics.makeText(px, py, tick.label, style.fontFamily, style.fontSize, { fillColor: style.tickColor })]);
                    gText.transform = {
                        x: tx + dx,
                        y: ty + dy,
                        angle: 0
                    };
                    g.elements.push(gText);
                }
            }
        }
        return g;
    }

    public renderCartesian(x: number, y: number, axis: "x" | "y"): Graphics.Group {
        switch (axis) {
            case "x": {
                return this.renderLine(x, y, 0, 1);
            }
            case "y": {
                return this.renderLine(x, y, 90, -1);
            }
        }
        // let style = this.style;
        // let rangeMin = this.rangeMin;
        // let rangeMax = this.rangeMax;
        // let tickSize = style.tickSize;
        // let lineStyle: Graphics.Style = {
        //     strokeLinecap: "square",
        //     strokeColor: style.axisColor
        // }
        // let g = Graphics.makeGroup([]);
        // g.transform.x = x; g.transform.y = y;
        // AxisRenderer.textMeasurer.setFontFamily(style.fontFamily)
        // AxisRenderer.textMeasurer.setFontSize(style.fontSize);
        // switch (axis) {
        //     case "x": {
        //         g.elements.push(Graphics.makeLine(rangeMin, 0, rangeMax, 0, lineStyle));
        //         g.elements.push(Graphics.makeLine(rangeMin, 0, rangeMin, -style.tickSize, lineStyle));
        //         g.elements.push(Graphics.makeLine(rangeMax, 0, rangeMax, -style.tickSize, lineStyle));
        //         for (let tick of this.ticks) {
        //             let metrics = AxisRenderer.textMeasurer.measure(tick.label);
        //             let dy = (metrics.middle - metrics.ideographicBaseline) * 2 - metrics.alphabeticBaseline;
        //             g.elements.push(Graphics.makeLine(tick.position, 0, tick.position, -style.tickSize, lineStyle));
        //             g.elements.push(Graphics.makeText(tick.position, -style.tickSize - dy, tick.label, style.fontFamily, style.fontSize, { fillColor: style.tickColor, textAnchor: "middle" }));
        //         }
        //     } break;
        //     case "y": {
        //         g.elements.push(Graphics.makeLine(0, rangeMin, 0, rangeMax, lineStyle));
        //         g.elements.push(Graphics.makeLine(0, rangeMin, -style.tickSize, rangeMin, lineStyle));
        //         g.elements.push(Graphics.makeLine(0, rangeMax, -style.tickSize, rangeMax, lineStyle));
        //         for (let tick of this.ticks) {
        //             let metrics = AxisRenderer.textMeasurer.measure(tick.label);
        //             let dy = metrics.middle - metrics.alphabeticBaseline;
        //             g.elements.push(Graphics.makeLine(0, tick.position, -style.tickSize, tick.position, lineStyle));
        //             g.elements.push(Graphics.makeText(-style.tickSize - 2, tick.position - dy, tick.label, style.fontFamily, style.fontSize, { fillColor: style.tickColor, textAnchor: "end" }));
        //         }
        //     } break;
        // }
        // return g;
    }

    public renderPolar(cx: number, cy: number, radius: number, side: number): Graphics.Group {
        let style = this.style;
        let rangeMin = this.rangeMin;
        let rangeMax = this.rangeMax;
        let tickSize = style.tickSize;
        let lineStyle: Graphics.Style = {
            strokeLinecap: "round",
            strokeColor: style.lineColor
        }
        let g = Graphics.makeGroup([]);
        g.transform.x = cx; g.transform.y = cy;

        let hintStyle = {
            strokeColor: { r: 0, g: 0, b: 0 },
            strokeOpacity: 0.1,
        };
        AxisRenderer.textMeasurer.setFontFamily(style.fontFamily)
        AxisRenderer.textMeasurer.setFontSize(style.fontSize);

        for (let tick of this.ticks) {
            let angle = tick.position;
            let radians = angle / 180 * Math.PI;
            let tx = Math.sin(radians) * radius;
            let ty = Math.cos(radians) * radius;

            let metrics = AxisRenderer.textMeasurer.measure(tick.label);
            let [textX, textY] = Graphics.TextMeasurer.ComputeTextPosition(0, style.tickSize * side, metrics, "middle", side > 0 ? "bottom" : "top", 0, 2)
            let gt = Graphics.makeGroup([
                Graphics.makeLine(0, 0, 0, style.tickSize * side, lineStyle),
                Graphics.makeText(textX, textY, tick.label, style.fontFamily, style.fontSize, { fillColor: style.tickColor })
            ]);

            gt.transform.angle = -angle;
            gt.transform.x = tx;
            gt.transform.y = ty;
            g.elements.push(gt);
        }
        return g;
    }

    public renderCurve(coordinateSystem: Graphics.CoordinateSystem, y: number, side: number): Graphics.Group {
        let style = this.style;
        let rangeMin = this.rangeMin;
        let rangeMax = this.rangeMax;
        let tickSize = style.tickSize;
        let lineStyle: Graphics.Style = {
            strokeLinecap: "round",
            strokeColor: style.lineColor
        }
        let g = Graphics.makeGroup([]);
        g.transform = coordinateSystem.getBaseTransform();

        let hintStyle = {
            strokeColor: { r: 0, g: 0, b: 0 },
            strokeOpacity: 0.1,
        };
        AxisRenderer.textMeasurer.setFontFamily(style.fontFamily)
        AxisRenderer.textMeasurer.setFontSize(style.fontSize);

        for (let tick of this.ticks) {
            let tangent = tick.position;

            let metrics = AxisRenderer.textMeasurer.measure(tick.label);
            let [textX, textY] = Graphics.TextMeasurer.ComputeTextPosition(0, -style.tickSize * side, metrics, "middle", side < 0 ? "bottom" : "top", 0, 2)
            let gt = Graphics.makeGroup([
                Graphics.makeLine(0, 0, 0, -style.tickSize * side, lineStyle),
                Graphics.makeText(textX, textY, tick.label, style.fontFamily, style.fontSize, { fillColor: style.tickColor })
            ]);

            gt.transform = coordinateSystem.getLocalTransform(tangent, y);
            g.elements.push(gt);
        }
        return g;
    }
}

export function getCategoricalAxis(data: Specification.Types.AxisDataBinding, enablePrePostGap: boolean) {
    if (data.enablePrePostGap) {
        enablePrePostGap = true;
    }
    let chunkSize = (1 - data.gapRatio) / data.categories.length;
    let preGap: number, postGap: number, gap: number, gapScale: number;
    if (enablePrePostGap) {
        gap = data.gapRatio / data.categories.length;
        gapScale = 1 / data.categories.length;
        preGap = gap / 2;
        postGap = gap / 2;
    } else {
        if (data.categories.length == 1) {
            gap = 0;
            gapScale = 1;
        } else {
            gap = data.gapRatio / (data.categories.length - 1);
            gapScale = 1 / (data.categories.length - 1);
        }
        preGap = 0;
        postGap = 0;
    }
    let chunkRanges = data.categories.map((c, i) => {
        return [preGap + (gap + chunkSize) * i, preGap + (gap + chunkSize) * i + chunkSize] as [number, number];
    });
    return {
        gap: gap,
        preGap: preGap,
        postGap: postGap,
        gapScale: gapScale,
        ranges: chunkRanges
    };
}

export function buildAxisWidgets(data: Specification.Types.AxisDataBinding, axisProperty: string, m: Controls.WidgetManager, axisName: string): Controls.Widget[] {
    let widgets = [];
    let dropzoneOptions: Controls.RowOptions = {
        dropzone: {
            type: "axis-data-binding",
            attribute: axisProperty,
            prompt: axisName + ": drop here to assign data"
        }
    };
    let makeAppearance = () => {
        if (data.visible) {
            return m.row("Visible", m.horizontal([0, 0, 1, 0],
                m.inputBoolean({ property: axisProperty, field: "visible" }, { type: "checkbox" }),
                m.label("Position:"),
                m.inputSelect({ property: axisProperty, field: "side" }, {
                    type: "dropdown",
                    showLabel: true,
                    options: ["default", "opposite"],
                    labels: ["Default", "Opposite"]
                }),
                m.detailsButton(
                    m.sectionHeader("Axis Style"),
                    m.row("Line Color", m.inputColor({ property: axisProperty, field: ["style", "lineColor"] })),
                    m.row("Tick Color", m.inputColor({ property: axisProperty, field: ["style", "tickColor"] })),
                    m.row("Tick Size", m.inputNumber({ property: axisProperty, field: ["style", "tickSize"] })),
                    m.row("Font Family", m.inputText({ property: axisProperty, field: ["style", "fontFamily"] })),
                    m.row("Font Size", m.inputNumber({ property: axisProperty, field: ["style", "fontSize"] }, { showUpdown: true, updownStyle: "font", updownTick: 2 }))
                )
            ));
        } else {
            return m.row("Visible",
                m.inputBoolean({ property: axisProperty, field: "visible" }, { type: "checkbox" })
            );
        }
    };
    if (data != null) {
        switch (data.type) {
            case "numerical": {
                widgets.push(m.sectionHeader(axisName + ": Numerical", m.clearButton({ property: axisProperty }), dropzoneOptions));
                widgets.push(m.row("Data",
                    m.inputExpression({ property: axisProperty, field: "expression" })
                ));
                widgets.push(m.row("Range", m.horizontal([1, 0, 1],
                    m.inputNumber({ property: axisProperty, field: "domainMin" }),
                    m.label(" - "),
                    m.inputNumber({ property: axisProperty, field: "domainMax" })
                )));
                widgets.push(m.row("TickData",
                    m.inputExpression({ property: axisProperty, field: "tickDataExpression" })
                ));
                widgets.push(makeAppearance());
            } break;
            case "categorical": {
                widgets.push(m.sectionHeader(axisName + ": Categorical", m.clearButton({ property: axisProperty }), dropzoneOptions));
                widgets.push(m.row("Data", m.horizontal([1, 0],
                    m.inputExpression({ property: axisProperty, field: "expression" }),
                    m.reorderWidget({ property: axisProperty, field: "categories" }),
                )));
                widgets.push(m.row("Gap",
                    m.inputNumber({ property: axisProperty, field: "gapRatio" }, { minimum: 0, maximum: 1, percentage: true, showSlider: true })
                ));
                widgets.push(makeAppearance());
            } break;
            case "default": {
                widgets.push(m.sectionHeader(axisName + ": Stacking", m.clearButton({ property: axisProperty }), dropzoneOptions));
                widgets.push(m.row("Gap",
                    m.inputNumber({ property: axisProperty, field: "gapRatio" }, { minimum: 0, maximum: 1, percentage: true, showSlider: true })
                ));
            } break;
        }
    } else {
        widgets.push(m.sectionHeader(axisName + ": (none)", null, dropzoneOptions));
    }
    return widgets;
}