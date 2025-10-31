class Margin {
    constructor(top, right, bottom, left) {
        this.top = top;
        this.right = right;
        this.bottom = bottom;
        this.left = left;
    }
}

export const barChartMargins = new Margin(25, 20, 40, 120);
export const groupedBarChartMargins = new Margin(25, 20, 90, 30);
export const fullBarChartMargins = new Margin(40, 20, 20, 110);
