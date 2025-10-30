export function observeRender(element, renderFunction, data, ...renderArgs) {
    // re-render when the container size changes
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => renderFunction(element, data, ...renderArgs));
        ro.observe(element);
    } else {
        // fallback to window resize if ResizeObserver is not available
        window.addEventListener("resize", () => renderFunction(element, data, ...renderArgs));
    }
}
