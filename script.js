"use strict";

/* =================================
   1. ЭЛЕМЕНТЫ СТРАНИЦЫ
================================= */

const preloader = document.getElementById("preloader");
const enterButton = document.getElementById("enterButton");
const siteContent = document.getElementById("siteContent");
const soundButton = document.getElementById("soundButton");

const bootSequence = document.getElementById("bootSequence");
const bootLine = document.getElementById("bootLine");
const bootProgressBar = document.getElementById("bootProgressBar");
const bootProgressText = document.getElementById("bootProgressText");

const hackTitle = document.getElementById("hackTitle");
const hackNoise = document.getElementById("hackNoise");
const hackFlash = document.getElementById("hackFlash");
const hackCode = document.getElementById("hackCode");
const hackCodeLines = document.querySelectorAll("#hackCode span");
const hackBlocks = document.querySelectorAll(".hack-blocks span");
const hackTears = document.querySelectorAll(".hack-tears span");

const glitchSound = document.getElementById("glitchSound");
const errorSound = document.getElementById("errorSound");
const powerSound = document.getElementById("powerSound");
const hoverSound = document.getElementById("hoverSound");
const clickSound = document.getElementById("clickSound");
const typeSound = document.getElementById("typeSound");
const ambientSound = document.getElementById("ambientSound");

const soundHoverElements = document.querySelectorAll(".sound-hover");
const heroTitle = document.getElementById("heroTitle");
const heroTitleLines = document.querySelectorAll(".hero-title-line");
const verseRows = document.querySelectorAll(".verse-row");
const versePreviewImage = document.getElementById("versePreviewImage");
const versePreviewEmpty = document.getElementById("versePreviewEmpty");
const versePreviewCode = document.getElementById("versePreviewCode");
const versePreviewState = document.getElementById("versePreviewState");

const navigationLinks = document.querySelectorAll(
    ".navigation a[data-transition-label]"
);
const pageTransition = document.getElementById("pageTransition");
const pageTransitionTitle = document.getElementById("pageTransitionTitle");


/* =================================
   2. СОСТОЯНИЕ
================================= */

let soundEnabled = sessionStorage.getItem("diiverseSound") !== "off";
let siteStarted = false;
let heroTyped = false;
let scrollTypingStarted = false;
let chaosInterval = null;
let ambientFadeFrame = null;
let ambientStartPromise = null;
let ambientResumeArmed = false;
let ambientResumeHandler = null;
let navigationTransitionActive = false;
let typingAudioContext = null;
let typingSoundBuffer = null;
let typingSoundLoading = false;

const AMBIENT_TARGET_VOLUME = 0.04;
const audioStopTimers = new WeakMap();


/* =================================
   3. НАСТРОЙКА ЗВУКА
================================= */

if (glitchSound) glitchSound.volume = 0.55;
if (errorSound) errorSound.volume = 0.42;
if (powerSound) powerSound.volume = 0.58;
if (hoverSound) hoverSound.volume = 0.38;
if (clickSound) clickSound.volume = 0.34;
if (typeSound) typeSound.volume = 0.35;
if (ambientSound) {

    ambientSound.volume = 0;
    ambientSound.preload = "auto";

    /*
     * Начинаем загружать файл
     * до нажатия кнопки входа.
     */

    ambientSound.load();

}

function updateSoundButton() {
    if (!soundButton) return;

    soundButton.textContent = soundEnabled
        ? "ЗВУК: ВКЛ"
        : "ЗВУК: ВЫКЛ";

    soundButton.setAttribute(
        "aria-pressed",
        String(soundEnabled)
    );
}

updateSoundButton();


/* =================================
   4. ВОСПРОИЗВЕДЕНИЕ ЗВУКА
================================= */

function safePlay(audioElement, errorLabel = "Ошибка воспроизведения:") {
    if (!audioElement) return Promise.resolve(false);

    const playResult = audioElement.play();

    if (!playResult || typeof playResult.catch !== "function") {
        return Promise.resolve(true);
    }

    return playResult
        .then(() => true)
        .catch((error) => {
            console.log(errorLabel, error);
            return false;
        });
}

function playOneShot(sourceAudio, volume = 0.35, playbackRate = 1) {
    if (!soundEnabled || !sourceAudio) return;

    const sound = sourceAudio.cloneNode(true);
    sound.volume = Math.max(0, Math.min(volume, 1));
    sound.playbackRate = playbackRate;

    sound.play().catch(() => {});
    sound.addEventListener("ended", () => sound.remove(), { once: true });
}

function playSoundSegment(audioElement, startTime, duration, volume) {
    if (!soundEnabled || !audioElement) return;

    const previousTimer = audioStopTimers.get(audioElement);
    if (previousTimer) clearTimeout(previousTimer);

    audioElement.pause();
    audioElement.volume = Math.max(0, Math.min(volume, 1));

    try {
        audioElement.currentTime = startTime;
    } catch (error) {
        console.log("Не удалось выбрать фрагмент:", error);
    }

    safePlay(audioElement, "Ошибка звука прелоадера:");

    const stopTimer = setTimeout(() => {
        audioElement.pause();
    }, duration);

    audioStopTimers.set(audioElement, stopTimer);
}

function stopSoundImmediately(audioElement) {
    if (!audioElement) return;

    const timer = audioStopTimers.get(audioElement);
    if (timer) clearTimeout(timer);

    audioElement.pause();
}

function stopBreachSounds() {
    stopSoundImmediately(glitchSound);
    stopSoundImmediately(errorSound);
    stopSoundImmediately(powerSound);
}

function fadeAudio(audioElement, targetVolume, duration = 1000) {
    if (!audioElement) return;

    if (ambientFadeFrame !== null) {
        cancelAnimationFrame(ambientFadeFrame);
        ambientFadeFrame = null;
    }

    const startVolume = audioElement.volume;
    const startedAt = performance.now();

    const step = (now) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        audioElement.volume = startVolume + (targetVolume - startVolume) * progress;

        if (progress < 1) {
            ambientFadeFrame = requestAnimationFrame(step);
        } else {
            ambientFadeFrame = null;
        }
    };

    ambientFadeFrame = requestAnimationFrame(step);
}

function savedAmbientTime() {
    const value = Number(sessionStorage.getItem("diiverseAmbientTime"));
    return Number.isFinite(value) && value >= 0 ? value : 0;
}

function saveAmbientTime() {
    if (!ambientSound) return;

    sessionStorage.setItem(
        "diiverseAmbientTime",
        String(ambientSound.currentTime || 0)
    );
}

function restoreAmbientTime() {
    if (!ambientSound) return;

    const savedTime = savedAmbientTime();

    try {
        if (
            !Number.isFinite(ambientSound.duration) ||
            ambientSound.duration <= 0 ||
            savedTime < ambientSound.duration
        ) {
            ambientSound.currentTime = savedTime;
        }
    } catch (error) {
        console.log("Не удалось восстановить позицию музыки:", error);
    }
}

function disarmAmbientResume() {
    if (!ambientResumeArmed || !ambientResumeHandler) return;

    ["pointerdown", "touchstart", "keydown", "click", "wheel"].forEach(
        (eventName) => {
            document.removeEventListener(eventName, ambientResumeHandler);
        }
    );

    ambientResumeArmed = false;
    ambientResumeHandler = null;
}

async function resumeAmbient(fadeDuration = 700) {
    if (!siteStarted || !soundEnabled || !ambientSound) return false;

    if (ambientStartPromise) {
        return ambientStartPromise;
    }

    ambientStartPromise = (async () => {
        if (ambientSound.paused) {
            ambientSound.volume = 0;

            const started = await safePlay(
                ambientSound,
                "Не удалось запустить фоновую музыку:"
            );

            if (!started) {
                armAmbientOnFirstInteraction();
                return false;
            }
        }

        disarmAmbientResume();
        fadeAudio(ambientSound, AMBIENT_TARGET_VOLUME, fadeDuration);
        return true;
    })();

    try {
        return await ambientStartPromise;
    } finally {
        ambientStartPromise = null;
    }
}

function startAmbientFromEnterGesture() {

    if (
        !soundEnabled ||
        !ambientSound
    ) {
        return;
    }


    /*
     * Всегда начинаем музыку сначала.
     * Это надёжнее, чем переходить
     * на сохранённую позицию большого файла.
     */

    try {

        ambientSound.currentTime = 0;

    } catch (error) {

        console.log(
            "Не удалось установить начало музыки:",
            error
        );

    }


    ambientSound.loop = true;
    ambientSound.preload = "auto";

    /*
     * Запускаем файл прямо во время клика,
     * но временно в беззвучном режиме.
     * Так Chrome реже блокирует воспроизведение.
     */

    ambientSound.muted = true;
    ambientSound.volume = 0;


    const playPromise =
        ambientSound.play();


    if (
        playPromise &&
        typeof playPromise.catch === "function"
    ) {

        playPromise.catch((error) => {

            console.log(
                "Не удалось запустить фоновую музыку:",
                error
            );

            ambientSound.muted = false;

            armAmbientOnFirstInteraction();

        });

    }

}

async function revealAmbient() {

    if (
        !soundEnabled ||
        !ambientSound
    ) {
        return;
    }


    /*
     * Прелоадер закончился.
     * Убираем временное отключение звука.
     */

    ambientSound.muted = false;


    /*
     * Если музыка уже запущена,
     * только плавно поднимаем громкость.
     */

    if (!ambientSound.paused) {

        disarmAmbientResume();

        fadeAudio(
            ambientSound,
            AMBIENT_TARGET_VOLUME,
            1100
        );

        return;

    }


    /*
     * Если браузер всё же остановил музыку,
     * пробуем запустить её повторно.
     */

    const started =
        await resumeAmbient(1100);


    if (!started) {

        armAmbientOnFirstInteraction();

    }

}

function pauseAmbient() {
    if (!ambientSound) return;

    if (ambientFadeFrame !== null) {
        cancelAnimationFrame(ambientFadeFrame);
        ambientFadeFrame = null;
    }

    saveAmbientTime();
    ambientSound.pause();
}

function armAmbientOnFirstInteraction() {
    if (
        ambientResumeArmed ||
        !siteStarted ||
        !soundEnabled ||
        !ambientSound ||
        !ambientSound.paused
    ) {
        return;
    }

    ambientResumeHandler = async () => {
        disarmAmbientResume();

        const started = await resumeAmbient(500);
        if (!started) armAmbientOnFirstInteraction();
    };

    ambientResumeArmed = true;

    ["pointerdown", "touchstart", "keydown", "click", "wheel"].forEach(
        (eventName) => {
            document.addEventListener(eventName, ambientResumeHandler, {
                passive: true
            });
        }
    );
}

window.addEventListener("pagehide", saveAmbientTime);

window.addEventListener("pageshow", () => {
    if (!siteStarted || !soundEnabled || !ambientSound) return;

    resumeAmbient(500);
    armAmbientOnFirstInteraction();
});

document.addEventListener("visibilitychange", () => {
    if (
        document.hidden ||
        !siteStarted ||
        !soundEnabled ||
        !ambientSound ||
        !ambientSound.paused
    ) {
        return;
    }

    resumeAmbient(500);
    armAmbientOnFirstInteraction();
});


/* =================================
   5. ЭФФЕКТ ВЗЛОМА
================================= */

let currentHackText = "DIIVERSE";

const glitchSymbols =
    "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@!?/<>[]{}";

const systemMessages = [
    "СОЕДИНЕНИЕ ПРЕРВАНО",
    "УЗЕЛ НЕ ОТВЕЧАЕТ",
    "ПАМЯТЬ ПОВРЕЖДЕНА",
    "ЗАПРОШЕН КОРНЕВОЙ ДОСТУП",
    "СИГНАЛ НЕСТАБИЛЕН",
    "ОБХОД ЗАЩИТЫ",
    "НЕИЗВЕСТНЫЙ ПРОЦЕСС",
    "КЛЮЧ АРХИВА ВНЕДРЁН",
    "ЗАЩИТА НЕ ОТВЕЧАЕТ",
    "УПРАВЛЕНИЕ ПОТЕРЯНО"
];

function createHackLetters(text = "DIIVERSE") {
    if (!hackTitle) return;

    currentHackText = text;
    hackTitle.innerHTML = "";

    text.split("").forEach((character) => {
        const letter = document.createElement("span");
        letter.textContent = character === " " ? "\u00A0" : character;
        hackTitle.appendChild(letter);
    });
}

function randomGlitchSymbol() {
    const index = Math.floor(Math.random() * glitchSymbols.length);
    return glitchSymbols[index];
}

function scrambleLetters(intensity) {
    if (!hackTitle) return;

    const letters = hackTitle.querySelectorAll("span");

    letters.forEach((letter, index) => {
        const maxX = 8 + intensity * 65;
        const maxY = 4 + intensity * 34;
        const maxRotation = 3 + intensity * 20;

        const randomX = (Math.random() * 2 - 1) * maxX;
        const randomY = (Math.random() * 2 - 1) * maxY;
        const randomRotation = (Math.random() * 2 - 1) * maxRotation;
        const randomScale = 0.88 + Math.random() * (0.12 + intensity * 0.32);

        const symbolChance = 0.05 + intensity * 0.32;
        const disappearChance = 0.01 + intensity * 0.08;

        const originalCharacter = currentHackText[index] || "";

        letter.textContent = Math.random() < symbolChance
            ? randomGlitchSymbol()
            : originalCharacter === " "
                ? "\u00A0"
                : originalCharacter;

        letter.style.transform = `translate(${randomX}px, ${randomY}px) rotate(${randomRotation}deg) scale(${randomScale})`;
        letter.style.opacity = Math.random() < disappearChance ? "0" : "1";
        letter.style.filter = Math.random() < 0.08 + intensity * 0.2
            ? "blur(1.5px)"
            : "none";
        letter.style.color = Math.random() < 0.05 + intensity * 0.18
            ? "#f04435"
            : "#f3f3f3";
    });
}

function randomizeBlocks(intensity) {
    hackBlocks.forEach((block) => {
        const width = 5 + Math.random() * (22 + intensity * 120);
        const height = 3 + Math.random() * (8 + intensity * 55);
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const shiftX = (Math.random() * 2 - 1) * intensity * 120;
        const shiftY = (Math.random() * 2 - 1) * intensity * 70;

        block.style.left = `${left}%`;
        block.style.top = `${top}%`;
        block.style.width = `${width}px`;
        block.style.height = `${height}px`;
        block.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
        block.style.opacity = String(0.1 + Math.random() * (0.25 + intensity * 0.6));
        block.style.background = Math.random() < 0.12 + intensity * 0.16
            ? "#ffffff"
            : "#f04435";
    });
}

function randomizeTears(intensity) {
    hackTears.forEach((tear) => {
        const top = Math.random() * 100;
        const left = Math.random() * 70;
        const width = 8 + Math.random() * (18 + intensity * 65);
        const height = 1 + Math.random() * (1 + intensity * 5);
        const shift = (Math.random() * 2 - 1) * intensity * 150;

        tear.style.top = `${top}%`;
        tear.style.left = `${left}%`;
        tear.style.width = `${width}%`;
        tear.style.height = `${height}px`;
        tear.style.transform = `translateX(${shift}px)`;
        tear.style.opacity = String(0.1 + Math.random() * intensity);
        tear.style.background = Math.random() > 0.55 ? "#ffffff" : "#f04435";
    });
}

function scrambleSystemCode() {
    hackCodeLines.forEach((line) => {
        const message = systemMessages[
            Math.floor(Math.random() * systemMessages.length)
        ];

        const hexCode = Math.floor(Math.random() * 65535)
            .toString(16)
            .toUpperCase()
            .padStart(4, "0");

        line.textContent = `${hexCode} // ${message}`;
    });
}

const shakeClasses = [
    "shake-low",
    "shake-medium",
    "shake-high",
    "shake-extreme"
];

function removeShakeClasses() {
    if (!preloader) return;
    shakeClasses.forEach((className) => preloader.classList.remove(className));
}

function restartShake(className) {
    if (!preloader) return;

    removeShakeClasses();
    void preloader.offsetWidth;
    preloader.classList.add(className);
}

function startHackBurst(level, duration, intensity, intervalTime) {
    if (!preloader) return;

    if (chaosInterval !== null) {
        clearInterval(chaosInterval);
        chaosInterval = null;
    }

    preloader.classList.remove("is-frozen");
    restartShake(`shake-${level}`);
    hackNoise?.classList.add("active");
    hackCode?.classList.add("active");

    const updateChaos = () => {
        scrambleLetters(intensity);
        randomizeBlocks(intensity);
        randomizeTears(intensity);
        scrambleSystemCode();
    };

    updateChaos();
    chaosInterval = setInterval(updateChaos, intervalTime);

    setTimeout(() => {
        if (chaosInterval !== null) {
            clearInterval(chaosInterval);
            chaosInterval = null;
        }

        removeShakeClasses();
        hackNoise?.classList.remove("active");
        hackCode?.classList.remove("active");
        preloader.classList.add("is-frozen");
    }, duration);
}

function flashScreen(color, duration = 70, opacity = 1) {
    if (!hackFlash) return;

    hackFlash.style.background = color;
    hackFlash.style.opacity = String(opacity);

    setTimeout(() => {
        hackFlash.style.opacity = "0";
    }, duration);
}

function blackoutScreen(duration) {
    if (!preloader) return;

    preloader.classList.add("blackout");
    setTimeout(() => preloader.classList.remove("blackout"), duration);
}

function updateBoot(text, percent, buttonText) {
    if (bootLine) bootLine.textContent = text;
    if (bootProgressBar) bootProgressBar.style.width = `${percent}%`;
    if (bootProgressText) bootProgressText.textContent = `${percent}%`;
    if (enterButton && buttonText) enterButton.textContent = buttonText;
}


/* =================================
   6. ПЕЧАТЬ ГЛАВНОГО ЗАГОЛОВКА
================================= */

function prepareHeroTitle() {
    heroTitleLines.forEach((line) => {
        const text = line.dataset.text || line.textContent || "";
        line.innerHTML = "";

        text.split("").forEach((character) => {
            const letter = document.createElement("span");
            letter.className = "hero-title-letter";
            letter.textContent = character === " " ? "\u00A0" : character;
            line.appendChild(letter);
        });
    });
}

function showHeroTitleImmediately() {
    heroTitleLines.forEach((line) => {
        line.textContent = line.dataset.text || "";
    });
    heroTyped = true;
}

function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getTypingAudioContext() {
    if (typingAudioContext) return typingAudioContext;

    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return null;

    typingAudioContext = new AudioContextClass();
    return typingAudioContext;
}

async function loadTypingSoundBuffer() {
    if (typingSoundBuffer || typingSoundLoading) return;

    const context = getTypingAudioContext();
    if (!context) return;

    typingSoundLoading = true;

    try {
        const response = await fetch("audio/type-kpr.wav?v=4", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        typingSoundBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    } catch (error) {
        console.warn(
            "Файл type-kpr.wav не загрузился. Используется встроенный звук:",
            error
        );
        typingSoundBuffer = null;
    } finally {
        typingSoundLoading = false;
    }
}

function playSyntheticTypingSound(volume = 0.28) {
    if (!soundEnabled) return;

    const context = getTypingAudioContext();
    if (!context) return;

    const play = () => {
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        const startFrequency = 1250 + Math.random() * 650;
        const peakVolume = Math.max(
            0.07,
            Math.min(0.2, volume * 0.48)
        );

        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(startFrequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(
            420,
            now + 0.055
        );

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(
            peakVolume,
            now + 0.002
        );
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.06
        );

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start(now);
        oscillator.stop(now + 0.065);
    };

    if (context.state === "suspended") {
        context.resume().then(play).catch(() => {});
        return;
    }

    play();
}

function playTypingSound(volume = 0.28) {
    if (!soundEnabled) return;

    const context = getTypingAudioContext();
    if (!context) return;

    const play = () => {
        if (!typingSoundBuffer) {
            playSyntheticTypingSound(volume);
            return;
        }

        const source = context.createBufferSource();
        const gain = context.createGain();

        source.buffer = typingSoundBuffer;
        source.playbackRate.value = 0.97 + Math.random() * 0.06;
        gain.gain.value = Math.max(0, Math.min(volume, 1));

        source.connect(gain);
        gain.connect(context.destination);
        source.start(0);
    };

    if (context.state === "suspended") {
        context.resume().then(play).catch(() => {
            playSyntheticTypingSound(volume);
        });
        return;
    }

    play();
}

function unlockTypingSound() {
    const context = getTypingAudioContext();
    if (!context) return;

    const unlock = () => {
        /*
         * Короткий почти неслышный импульс запускается прямо
         * внутри клика/касания и разблокирует Web Audio.
         */
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const now = context.currentTime;

        oscillator.type = "square";
        oscillator.frequency.value = 700;
        gain.gain.setValueAtTime(0.0001, now);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.02);

        loadTypingSoundBuffer();
    };

    if (context.state === "suspended") {
        context.resume().then(unlock).catch(() => {});
    } else {
        unlock();
    }
}

/*
 * Нужен для случаев, когда прелоадер был пропущен
 * после возврата с внутренней страницы.
 */
const typingUnlockEvents = [
    "pointerdown",
    "touchstart",
    "click",
    "keydown",
    "wheel"
];

function unlockTypingFromFirstInteraction() {
    unlockTypingSound();

    typingUnlockEvents.forEach((eventName) => {
        document.removeEventListener(
            eventName,
            unlockTypingFromFirstInteraction,
            true
        );
    });
}

typingUnlockEvents.forEach((eventName) => {
    document.addEventListener(
        eventName,
        unlockTypingFromFirstInteraction,
        {
            capture: true,
            passive: true
        }
    );
});

async function typeHeroTitle() {
    if (!heroTitle || heroTyped) return;
    heroTyped = true;

    const cursor = document.createElement("span");
    cursor.className = "hero-title-cursor";

    const lines = Array.from(heroTitleLines);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const letters = line.querySelectorAll(".hero-title-letter");

        line.appendChild(cursor);

        for (const letter of letters) {
            letter.classList.add("is-visible");

            if (letter.textContent.trim() !== "") {
                playTypingSound(0.34);
            }

            await wait(45 + Math.random() * 35);
        }

        cursor.remove();

        if (lineIndex < lines.length - 1) {
            await wait(150);
        }
    }

    const lastLine = lines[lines.length - 1];
    lastLine.appendChild(cursor);
    await wait(450);
    cursor.remove();
}


/* =================================
   7. ПЕЧАТЬ ТЕКСТА ПРИ ПРОКРУТКЕ
================================= */

function wrapTextNodeForTyping(textNode) {
    const original = textNode.nodeValue;

    if (!original || !original.trim()) return;

    const normalized = original.replace(/\s+/g, " ").trim();
    const fragment = document.createDocumentFragment();
    const tokens = normalized.split(/(\s+)/);

    tokens.forEach((token) => {
        if (!token) return;

        if (/^\s+$/.test(token)) {
            fragment.appendChild(document.createTextNode(" "));
            return;
        }

        const word = document.createElement("span");
        word.className = "scroll-type-word";

        token.split("").forEach((character) => {
            const letter = document.createElement("span");
            letter.className = "scroll-type-char";
            letter.textContent = character;
            word.appendChild(letter);
        });

        fragment.appendChild(word);
    });

    textNode.replaceWith(fragment);
}

function prepareScrollTypingElement(element) {
    if (!element || element.dataset.typingPrepared === "true") return;

    const readableText = element.textContent.replace(/\s+/g, " ").trim();
    if (readableText && !element.hasAttribute("aria-label")) {
        element.setAttribute("aria-label", readableText);
    }

    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT
    );

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(wrapTextNodeForTyping);
    element.dataset.typingPrepared = "true";
}

function prepareScrollTyping() {
    document
        .querySelectorAll("[data-type-scroll]")
        .forEach(prepareScrollTypingElement);
}

function showScrollTypingImmediately() {
    document
        .querySelectorAll(".scroll-type-char")
        .forEach((character) => character.classList.add("is-visible"));
}

async function typeScrollElement(element) {
    if (!element || element.dataset.typed === "true") return;

    element.dataset.typed = "true";

    const characters = element.querySelectorAll(".scroll-type-char");
    const soundForThisElement =
        element.dataset.typeSound === "true";

    for (const character of characters) {
        character.classList.add("is-visible");

        /*
         * Звук есть только у крупных заголовков
         * и основного текста. Маленькие подписи,
         * коды, статусы и нижние строки печатаются тихо.
         */
        if (
            soundForThisElement &&
            character.textContent.trim() !== ""
        ) {
            playTypingSound(0.15);
        }

        await wait(17 + Math.random() * 16);
    }
}

async function typeSection(section) {
    if (!section || section.dataset.sectionTyped === "true") return;

    section.dataset.sectionTyped = "true";
    const elements = Array.from(section.querySelectorAll("[data-type-scroll]"));

    for (const element of elements) {
        await typeScrollElement(element);
        await wait(55);
    }
}

function initScrollTyping() {
    if (scrollTypingStarted) return;
    scrollTypingStarted = true;

    const sections = document.querySelectorAll("[data-type-section]");

    if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !("IntersectionObserver" in window)
    ) {
        showScrollTypingImmediately();
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;

                observer.unobserve(entry.target);
                typeSection(entry.target);
            });
        },
        {
            threshold: 0.18,
            rootMargin: "0px 0px -12% 0px"
        }
    );

    sections.forEach((section) => observer.observe(section));
}



/* =================================
   8. АНИМАЦИЯ НАВИГАЦИИ
================================= */

function prepareNavigationLetters() {
    navigationLinks.forEach((link) => {
        if (link.dataset.lettersPrepared === "true") return;

        const label = (
            link.dataset.transitionLabel ||
            link.textContent ||
            ""
        ).trim();

        link.setAttribute("aria-label", label);
        link.textContent = "";

        Array.from(label).forEach((character, index) => {
            const letter = document.createElement("span");
            letter.className = "nav-letter";
            letter.style.setProperty("--letter-index", String(index));
            letter.textContent = character === " " ? "\u00A0" : character;
            letter.setAttribute("aria-hidden", "true");
            link.appendChild(letter);
        });

        link.dataset.lettersPrepared = "true";
    });
}

function fillTransitionTitle(label) {
    if (!pageTransitionTitle) return [];

    pageTransitionTitle.innerHTML = "";

    return Array.from(label).map((character, index) => {
        const letter = document.createElement("span");
        letter.className = "page-transition__letter";
        letter.style.setProperty("--transition-index", String(index));
        letter.textContent = character === " " ? "\u00A0" : character;
        pageTransitionTitle.appendChild(letter);
        return letter;
    });
}

async function closeInternalTransition() {
    if (!pageTransition) return;

    pageTransition.classList.add("is-closing");
    await wait(260);

    pageTransition.classList.remove("is-active", "is-closing");
    pageTransition.setAttribute("aria-hidden", "true");
    document.body.classList.remove("transition-lock");
}

async function runNavigationTransition(link) {
    if (
        navigationTransitionActive ||
        !link ||
        !pageTransition ||
        !pageTransitionTitle
    ) {
        return;
    }

    const href = link.getAttribute("href");
    const label = (
        link.dataset.transitionLabel ||
        link.getAttribute("aria-label") ||
        link.textContent ||
        "РАЗДЕЛ"
    ).trim();

    if (!href) return;

    navigationTransitionActive = true;
    link.classList.add("is-animating");
    document.body.classList.add("transition-lock");

    unlockTypingSound();

    const letters = fillTransitionTitle(label);

    pageTransition.setAttribute("aria-hidden", "false");
    pageTransition.classList.add("is-active");

    await wait(100);

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    for (const letter of letters) {
        letter.classList.add("is-visible");

        if (
            !reducedMotion &&
            letter.textContent.trim() !== ""
        ) {
            playTypingSound(0.105);
        }

        await wait(reducedMotion ? 0 : 34 + Math.random() * 24);
    }

    await wait(reducedMotion ? 80 : 210);

    if (href.startsWith("#")) {
        const target = document.querySelector(href);

        await closeInternalTransition();

        link.classList.remove("is-animating");
        navigationTransitionActive = false;

        if (target) {
            target.scrollIntoView({
                behavior: reducedMotion ? "auto" : "smooth",
                block: "start"
            });

            history.pushState(null, "", href);
        }

        return;
    }

    if (ambientSound && !ambientSound.paused) {
        fadeAudio(ambientSound, 0, 320);
    }

    pageTransition.classList.add("is-loading");
    saveAmbientTime();

    await wait(reducedMotion ? 100 : 360);
    window.location.assign(href);
}

function initNavigationTransitions() {
    prepareNavigationLetters();

    navigationLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            event.preventDefault();
            runNavigationTransition(link);
        });
    });
}

initNavigationTransitions();


/* =================================
   9. СПОСОБ ОТКРЫТИЯ СТРАНИЦЫ
================================= */

createHackLetters();
prepareHeroTitle();
prepareScrollTyping();

const navigationEntry = performance.getEntriesByType("navigation")[0];
const navigationType = navigationEntry ? navigationEntry.type : "navigate";
const pageWasReloaded = navigationType === "reload";
const userAlreadyEntered = sessionStorage.getItem("diiverseEntered") === "true";

/*
 * Обновление страницы: прелоадер показывается.
 * Возврат назад или переход с внутренней страницы: прелоадер пропускается.
 */
const shouldSkipPreloader = userAlreadyEntered && !pageWasReloaded;

function showSiteImmediately() {
    preloader?.classList.add("hidden");
    siteContent?.classList.add("visible");
    document.body.style.overflow = "auto";

    siteStarted = true;
    showHeroTitleImmediately();
    initScrollTyping();

    revealAmbient();
    armAmbientOnFirstInteraction();
}

if (shouldSkipPreloader) {
    showSiteImmediately();
}


/* =================================
   10. КНОПКА ВХОДА И ПРЕЛОАДЕР
================================= */

enterButton?.addEventListener("click", () => {
    if (siteStarted) return;

    siteStarted = true;
    unlockTypingSound();

    /* Запускаем музыку прямо внутри клика, но пока без громкости. */
    startAmbientFromEnterGesture();

    preloader?.classList.add("is-hacking");
    bootSequence?.classList.add("active");
    enterButton.classList.add("booting");

    updateBoot("СОЕДИНЕНИЕ ПРЕРВАНО", 8, "ПОДКЛЮЧЕНИЕ...");
    playSoundSegment(glitchSound, 0, 240, 0.38);
    startHackBurst("low", 260, 0.28, 95);

    setTimeout(() => {
        updateBoot("СИГНАЛ ПОТЕРЯН // ПОВТОР", 14, "НЕТ ОТВЕТА");
        playSoundSegment(errorSound, 0, 260, 0.38);
    }, 300);

    setTimeout(() => {
        updateBoot("ЗАЩИТА ОБНАРУЖИЛА ВМЕШАТЕЛЬСТВО", 32, "ОБХОД ЗАЩИТЫ...");
        flashScreen("#f04435", 55, 0.28);
        playSoundSegment(glitchSound, 0.7, 420, 0.5);
        startHackBurst("medium", 420, 0.55, 75);
    }, 650);

    setTimeout(() => {
        updateBoot("ПРОЦЕСС ЗАВИС", 43, "ОЖИДАНИЕ...");
    }, 1100);

    setTimeout(() => {
        updateBoot("КАРТА ПАМЯТИ ПОВРЕЖДЕНА", 67, "ПЕРЕХВАТ УПРАВЛЕНИЯ...");
        flashScreen("#ffffff", 45, 0.42);
        playSoundSegment(glitchSound, 1.6, 650, 0.63);
        startHackBurst("high", 650, 0.82, 60);
    }, 1450);

    setTimeout(() => {
        stopBreachSounds();
        updateBoot("СИСТЕМА НЕ ОТВЕЧАЕТ", 76, "СБОЙ СИСТЕМЫ");
    }, 2140);

    setTimeout(() => {
        updateBoot("КОРНЕВОЙ ДОСТУП ПОЛУЧЕН", 92, "ВЗЛОМ...");
        flashScreen("#f04435", 65, 0.65);
        playSoundSegment(errorSound, 0, 330, 0.48);
        playSoundSegment(glitchSound, 2.8, 620, 0.76);
        startHackBurst("extreme", 620, 1, 45);
    }, 2350);

    setTimeout(() => {
        if (chaosInterval !== null) {
            clearInterval(chaosInterval);
            chaosInterval = null;
        }

        removeShakeClasses();
        stopBreachSounds();
        blackoutScreen(95);
    }, 2980);

    setTimeout(() => {
        preloader?.classList.remove("is-frozen");
        createHackLetters("ДОСТУП//РАЗРЕШЁН");
        updateBoot("ЦИФРОВОЙ АРХИВ ПРОЕКТОВ ОТКРЫТ", 100, "ДОСТУП РАЗРЕШЁН");
        playSoundSegment(powerSound, 0, 420, 0.58);
        flashScreen("#ffffff", 55, 0.9);
    }, 3120);

    setTimeout(() => {
        flashScreen("#f04435", 65, 1);
    }, 3270);

    setTimeout(() => {
        if (chaosInterval !== null) {
            clearInterval(chaosInterval);
            chaosInterval = null;
        }

        preloader?.classList.add("hidden");
        siteContent?.classList.add("visible");
        document.body.style.overflow = "auto";

        sessionStorage.setItem("diiverseEntered", "true");

        revealAmbient();
        initScrollTyping();

        setTimeout(() => typeHeroTitle(), 180);
    }, 3400);
});


/* =================================
   11. ЗВУКИ ИНТЕРФЕЙСА
================================= */

soundHoverElements.forEach((element) => {
    element.addEventListener("mouseenter", () => {
        if (!soundEnabled || !siteStarted) return;
        playOneShot(hoverSound, 0.32, 1);
    });

    element.addEventListener("click", () => {
        if (
            element === enterButton ||
            element.classList.contains("nav-transition-link") ||
            !soundEnabled ||
            !siteStarted
        ) {
            return;
        }

        playOneShot(clickSound, 0.32, 1);
    });
});

soundButton?.addEventListener("click", async () => {
    soundEnabled = !soundEnabled;
    sessionStorage.setItem("diiverseSound", soundEnabled ? "on" : "off");
    updateSoundButton();

    if (!soundEnabled) {
        stopBreachSounds();
        pauseAmbient();
        hoverSound?.pause();
        clickSound?.pause();
        typeSound?.pause();
        return;
    }

    if (siteStarted) {
        const started = await resumeAmbient(500);
        if (!started) armAmbientOnFirstInteraction();
    }
});


/* =================================
   12. ПРЕВЬЮ ПРОЕКТОВ
================================= */

function activateVerseRow(row) {
    if (
        !row ||
        !versePreviewImage ||
        !versePreviewEmpty ||
        !versePreviewCode ||
        !versePreviewState
    ) {
        return;
    }

    const image = row.dataset.image || "";
    const code = row.dataset.code || "";
    const state = row.dataset.state || "";

    verseRows.forEach((item) => item.classList.remove("is-active"));
    row.classList.add("is-active");

    versePreviewCode.textContent = code;
    versePreviewState.textContent = state;

    if (image) {
        versePreviewImage.src = image;
        versePreviewImage.style.opacity = "1";
        versePreviewEmpty.classList.remove("is-visible");
    } else {
        versePreviewImage.style.opacity = "0";
        versePreviewEmpty.classList.add("is-visible");
    }
}

verseRows.forEach((row) => {
    row.addEventListener("mouseenter", () => activateVerseRow(row));
    row.addEventListener("focusin", () => activateVerseRow(row));

    if (row.classList.contains("verse-row--locked")) {
        row.addEventListener("click", () => activateVerseRow(row));
    }
});

versePreviewImage?.addEventListener("error", () => {
    versePreviewImage.style.opacity = "0";
    versePreviewEmpty?.classList.add("is-visible");

    if (versePreviewState) {
        versePreviewState.textContent = "ИЗОБРАЖЕНИЕ НЕ НАЙДЕНО";
    }
});
