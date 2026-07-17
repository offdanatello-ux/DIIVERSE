"use strict";

const hoverSound = document.getElementById("hoverSound");
const clickSound = document.getElementById("clickSound");
const soundButton = document.getElementById("soundButton");
const interactiveElements = document.querySelectorAll(
    "a, button, .about-card, .service-item"
);

let soundEnabled = sessionStorage.getItem("diiverseSound") !== "off";
let audioUnlocked = false;

function updateSoundButton() {
    if (!soundButton) return;

    soundButton.textContent = soundEnabled
        ? "ЗВУК: ВКЛ"
        : "ЗВУК: ВЫКЛ";

    soundButton.setAttribute("aria-pressed", String(soundEnabled));
}

function playOneShot(sourceAudio, volume = 0.35) {
    if (!soundEnabled || !audioUnlocked || !sourceAudio) return;

    const sound = sourceAudio.cloneNode(true);
    sound.volume = Math.max(0, Math.min(volume, 1));
    sound.play().catch(() => {});
    sound.addEventListener("ended", () => sound.remove(), { once: true });
}

function unlockAudio() {
    audioUnlocked = true;
}

document.addEventListener("pointerdown", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });

interactiveElements.forEach((element) => {
    element.addEventListener("mouseenter", () => {
        playOneShot(hoverSound, 0.38);
    });

    element.addEventListener("click", () => {
        audioUnlocked = true;
        playOneShot(clickSound, 0.34);
    });
});

soundButton?.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    sessionStorage.setItem("diiverseSound", soundEnabled ? "on" : "off");
    updateSoundButton();
});

updateSoundButton();

/* Появление блоков страницы проекта */
const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;

                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            });
        },
        { threshold: 0.12 }
    );

    revealElements.forEach((element) => revealObserver.observe(element));
} else {
    revealElements.forEach((element) => element.classList.add("visible"));
}
