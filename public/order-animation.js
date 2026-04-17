let cachedRuntime = null;

async function loadRuntime() {
  if (cachedRuntime) return cachedRuntime;
  const [{ default: React }, { createRoot }, { motion, useAnimation }] = await Promise.all([
    import("https://esm.sh/react@18.3.1"),
    import("https://esm.sh/react-dom@18.3.1/client"),
    import("https://esm.sh/framer-motion@11.11.17?external=react")
  ]);
  cachedRuntime = { React, createRoot, motion, useAnimation };
  return cachedRuntime;
}

function normalizeProductType(raw) {
  const v = String(raw || "").toLowerCase();
  if (v.includes("necklace")) return "necklace";
  if (v.includes("bracelet")) return "bracelet";
  if (v.includes("ring")) return "ring";
  if (v.includes("keychain")) return "keychain";
  return "other";
}

function createOrderAnimationComponent({ React, motion, useAnimation }) {
  return function OrderAnimation({ productType, engravingText, onComplete }) {
    const itemControls = useAnimation();
    const lidControls = useAnimation();
    const boxControls = useAnimation();
    const glowControls = useAnimation();
    const wrapControls = useAnimation();

    React.useEffect(() => {
      let cancelled = false;
      const run = async () => {
        await glowControls.start({
          opacity: [0.15, 0.42, 0.2],
          scale: [0.9, 1.06, 1],
          transition: { duration: 0.52, ease: "easeInOut" }
        });
        await itemControls.start({
          y: [0, 76, 132],
          scale: [1, 0.98, 0.9],
          opacity: [1, 1, 0.84],
          transition: { duration: 0.86, ease: [0.22, 1, 0.36, 1] }
        });
        await lidControls.start({
          rotateX: [0, -16, -86],
          y: [0, -4, -6],
          transition: { duration: 0.42, ease: [0.25, 0.1, 0.25, 1] }
        });
        await lidControls.start({
          rotateX: -2,
          y: 0,
          transition: { duration: 0.24, ease: "easeOut" }
        });
        await boxControls.start({
          x: [-8, -130, -260],
          scale: [1, 1.02, 0.96],
          opacity: [1, 1, 0.25],
          transition: { duration: 0.72, ease: [0.4, 0, 1, 1] }
        });
        await wrapControls.start({
          opacity: 0,
          transition: { duration: 0.22, ease: "easeOut" }
        });
        if (!cancelled) onComplete?.();
      };
      run().catch(() => onComplete?.());
      return () => {
        cancelled = true;
      };
    }, [boxControls, glowControls, itemControls, lidControls, onComplete, wrapControls]);

    const type = normalizeProductType(productType);
    const engraving = String(engravingText || "").trim() || "באהבה";

    return React.createElement(
      motion.div,
      {
        className: "order-animation-overlay",
        initial: { opacity: 0 },
        animate: wrapControls,
        style: { opacity: 1 }
      },
      React.createElement(
        "div",
        { className: "order-animation-shell" },
        React.createElement(
          motion.div,
          { className: "order-animation-glow", animate: glowControls },
          null
        ),
        React.createElement(
          "div",
          { className: "order-animation-stage" },
          React.createElement(
            motion.div,
            {
              className: `order-animation-item order-animation-item--${type}`,
              animate: itemControls
            },
            React.createElement("span", { className: "order-animation-engraving" }, engraving)
          ),
          React.createElement(
            motion.div,
            { className: "order-animation-box", animate: boxControls },
            React.createElement(motion.div, {
              className: "order-animation-box-lid",
              animate: lidControls
            }),
            React.createElement("div", { className: "order-animation-box-base" }),
            React.createElement("div", { className: "order-animation-box-shadow" })
          )
        )
      )
    );
  };
}

export async function playOrderAnimation({ productType = "other", engravingText = "", host = document.body } = {}) {
  const { React, createRoot, motion, useAnimation } = await loadRuntime();
  const OrderAnimation = createOrderAnimationComponent({ React, motion, useAnimation });

  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.className = "order-animation-mount";
    host.appendChild(container);
    const root = createRoot(container);

    const finish = () => {
      setTimeout(() => {
        root.unmount();
        container.remove();
        resolve();
      }, 30);
    };

    root.render(
      React.createElement(OrderAnimation, {
        productType,
        engravingText,
        onComplete: finish
      })
    );
  });
}
