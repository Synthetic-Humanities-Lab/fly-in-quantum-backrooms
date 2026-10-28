// Main first-person HUD radiation effect. Animation time belongs to the world,
// so pausing or waiting for a neural block also freezes this presentation.
export function createRadiationOverlay(container) {
  const glow = document.createElement("div");
  glow.dataset.effect = "radiation";
  glow.style.cssText = "position:absolute;inset:0;pointer-events:none";
  glow.hidden = true;
  container.append(glow);
  const low =
      "inset 0 0 60px 8px rgba(168,85,247,.2), inset 0 0 120px 20px rgba(124,58,237,.1)",
    high =
      "inset 0 0 80px 12px rgba(168,85,247,.35), inset 0 0 150px 30px rgba(124,58,237,.2)";
  const animation = glow.animate(
    [low, high, low].map((boxShadow) => ({
      boxShadow,
      easing: "ease-in-out",
    })),
    { duration: 1500, iterations: Infinity },
  );
  animation.pause();
  let enteredAt = null;
  return {
    update(world, observer, time) {
      const active = world.isRadiating(observer);
      if (!active) enteredAt = null;
      else if (enteredAt === null || time < enteredAt) enteredAt = time;
      glow.hidden = !active;
      animation.currentTime = active ? (time - enteredAt) * 1000 : 0;
    },
    reset() {
      enteredAt = null;
      glow.hidden = true;
      animation.currentTime = 0;
    },
  };
}
