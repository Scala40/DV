export async function observeRender(element, renderFunction, data, ...renderArgs) {
    // helper that invokes renderFunction asynchronously and logs errors
    const invoke = (...args) => {
        Promise.resolve()
            .then(() => renderFunction(...args))
            .catch(err => console.error('renderFunction error:', err));
    };

    // initial async render
    invoke(element, data, ...renderArgs);

    // re-render when the container size changes
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => invoke(element, data, ...renderArgs));
        ro.observe(element);
    } else {
        // fallback to window resize if ResizeObserver is not available
        window.addEventListener("resize", () => invoke(element, data, ...renderArgs));
    }
}
