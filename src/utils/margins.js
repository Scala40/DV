class Margin {
    constructor({ top, right, bottom, left }) {
        this.top = top;
        this.right = right;
        this.bottom = bottom;
        this.left = left;
    }
}

export const barChartMargins = new Margin({
    top: 25,
    right: 20,
    bottom: 40,
    left: 120
});

export const groupedBarChartMargins = new Margin({
    top: 25,
    right: 20,
    bottom: 90,
    left: 30
});

export const heatmapChartMargins = new Margin({
    top: 40,
    right: 100,
    bottom: 60,
    left: 100
});

export const fullBarChartMargins = new Margin({
    top: 40,
    right: 20,
    bottom: 20,
    left: 110
});

export const waffleChartMargins = new Margin({
    top: 20,
    right: 20,
    bottom: 0,
    left: 20
});
