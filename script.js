/* =========================
   Game State
========================= */

const savedState = JSON.parse(
  localStorage.getItem("namelessWeddingSave")
);

const gameState = savedState || {
  currentScene: "hall",

  clues: [],

  unlockedScenes: ["hall"],

  soundEnabled: true
};

if (!gameState.playerName) {
  gameState.playerName = "";
}

if (!gameState.visitedScenes) {
  gameState.visitedScenes = [];
}

if (!gameState.inventory) {
  gameState.inventory = [];
}

if (!gameState.solvedDolls) {
  gameState.solvedDolls = [];
}
if (!gameState.usedItems) {
  gameState.usedItems = [];
}
if (!gameState.collectedRewards) {
  gameState.collectedRewards = [];
}
if (!gameState.bedroomProgress) {
  gameState.bedroomProgress = {
    scissorsCollected: false,
    diaryCollected: false,
    dressCut: false,
    keyCollected: false
  };
}
const hasBedroomKey =
  gameState.bedroomProgress.keyCollected ||
  gameState.inventory.includes("key");

const hasSavedDiary = gameState.clues.some(function (clue) {
  return clue.id === "diary";
});

if (
  hasBedroomKey &&
  hasSavedDiary &&
  !gameState.unlockedScenes.includes("workshop")
) {
  gameState.unlockedScenes.push("workshop");
}
if (!gameState.workshopProgress) {
  gameState.workshopProgress = {
    ledgerFound: false,
    ledgerRevealed: false,
    cabinetOpened: false,
    contractBottomCollected: false,
    photoFragmentCollected: false
  };
}
if (!gameState.corridorProgress) {
  gameState.corridorProgress = {
    mirrorRevealed: false,
    narrativePlayed: false,
    ending: null
  };
}
const savedMarriageTop =
  gameState.clues.some(function (clue) {
    return clue.id === "marriage-top";
  });

if (savedMarriageTop) {
  if (
    !gameState.inventory.includes(
      "marriage-top"
    )
  ) {
    gameState.inventory.push(
      "marriage-top"
    );
  }

  gameState.clues =
    gameState.clues.filter(function (clue) {
      return clue.id !== "marriage-top";
    });
}
const savedMarriageBottom =
  gameState.clues.some(function (clue) {
    return clue.id === "marriage-bottom";
  });

if (savedMarriageBottom) {
  if (
    !gameState.inventory.includes(
      "marriage-bottom"
    )
  ) {
    gameState.inventory.push(
      "marriage-bottom"
    );
  }

  gameState.clues =
    gameState.clues.filter(function (clue) {
      return clue.id !== "marriage-bottom";
    });
}
let selectedItemId = null;


/* =========================
   Audio & SFX System
========================= */

const bgmAudio = new Audio();
bgmAudio.loop = true;
let currentBgmPath = "";

const bgmTracks = {
  start: "audio/Opening&LivingRoom.mp3",
  hall: "audio/Opening&LivingRoom.mp3",
  wedding: "audio/FourPeople.mp3",
  bedroom: "audio/BrideRoom.mp3",
  workshop: "audio/PaperDoll.mp3",
  corridor: "audio/Corridor.mp3"
};

// Ending sound effects. Put the audio files in the audio/ folder with these names.
const endingSounds = {
  truth: "audio/HappyEnding.mp3",

  // TODO: replace this with the final horror sound for the failure ending (Ending B).
  // Just drop the new file in as audio/BadEnding.mp3, or change this path.
  substitute: "audio/BadEnding.mp3"
};

// Scene background music control
function playSceneBgm(sceneKey) {
  const targetTrack = bgmTracks[sceneKey];
  if (!targetTrack) return;

  if (currentBgmPath !== targetTrack) {
    currentBgmPath = targetTrack;
    bgmAudio.src = targetTrack;
    bgmAudio.load();
  }

  bgmAudio.muted = !gameState.soundEnabled;

  if (gameState.soundEnabled) {
    bgmAudio.play().catch(function (err) {
      console.log("Waiting for user interaction to allow autoplay:", err);
    });
  }
}

// 1. Try to play the opening music Opening&LivingRoom.mp3 as soon as the page loads
playSceneBgm("start");

// 2. Work around browser autoplay limits: catch any click/keypress on the page and start audio immediately
function startInitialAudio() {
  if (gameState.soundEnabled) {
    if (bgmAudio.paused || !currentBgmPath) {
      playSceneBgm("start");
    }
  }
  // Remove listeners after the first trigger
  document.removeEventListener("click", startInitialAudio);
  document.removeEventListener("keydown", startInitialAudio);
  document.removeEventListener("touchstart", startInitialAudio);
}

document.addEventListener("click", startInitialAudio);
document.addEventListener("keydown", startInitialAudio);
document.addEventListener("touchstart", startInitialAudio);


// Standalone SFX player (with volume control and timed playback)
function playSfx(sfxPath, loop = false, maxDurationSeconds = null, volume = 1.0) {
  if (!gameState.soundEnabled) return null;
  const sfx = new Audio(sfxPath);
  sfx.loop = loop;
  sfx.volume = Math.min(Math.max(volume, 0.0), 1.0);
  
  sfx.play().catch(function (err) {
    console.log("SFX play error:", err);
  });

  if (maxDurationSeconds) {
    setTimeout(function () {
      if (!sfx.paused) {
        sfx.pause();
        sfx.currentTime = 0;
      }
    }, maxDurationSeconds * 1000);
  }

  return sfx;
}

// Radio broadcast and long voice controller
let radioAudioObj = null;
let radioNarrativeObj = null;

function playRadioEffects() {
  stopRadioEffects();
  if (!gameState.soundEnabled) return;
  radioAudioObj = playSfx("audio/Radio.mp3", true);
  radioNarrativeObj = playSfx("audio/Radionarrative.mp3", false);
}

function stopRadioEffects() {
  if (radioAudioObj) {
    radioAudioObj.pause();
    radioAudioObj = null;
  }
  if (radioNarrativeObj) {
    radioNarrativeObj.pause();
    radioNarrativeObj = null;
  }
}

// Play the opening background music
playSceneBgm("start");

// Handle browser autoplay restrictions
document.addEventListener("click", function unlockAudio() {
  if (gameState.soundEnabled && bgmAudio.paused && currentBgmPath) {
    bgmAudio.play().catch(function () {});
  }
}, { once: true });


/* =========================
   Clue Counter UI
========================= */

function updateClueCounter() {
  const counterElement = document.querySelector("#clue-counter");
  if (!counterElement) return;

  let remaining = 0;

  switch (gameState.currentScene) {
    case "hall": {
      const required = ["radio", "photo", "invitation"];
      const found = required.filter(function (id) {
        return gameState.clues.some(function (clue) {
          return clue.id === id;
        });
      }).length;
      remaining = Math.max(0, required.length - found);
      break;
    }

    case "wedding": {
      remaining = Math.max(0, 4 - gameState.solvedDolls.length);
      break;
    }

    case "bedroom": {
      const hasDiary = gameState.clues.some(function (c) { return c.id === "diary"; });
      const hasKey = gameState.bedroomProgress.keyCollected || gameState.inventory.includes("key");
      let count = 0;
      if (!hasDiary) count++;
      if (!hasKey) count++;
      remaining = count;
      break;
    }

    case "workshop": {
      let count = 0;
      if (!gameState.workshopProgress.ledgerRevealed) count++;
      if (!gameState.workshopProgress.contractBottomCollected) count++;
      if (!gameState.workshopProgress.photoFragmentCollected) count++;
      remaining = count;
      break;
    }

    case "corridor": {
      remaining = gameState.corridorProgress.mirrorRevealed ? 0 : 1;
      break;
    }

    default:
      remaining = 0;
  }

  counterElement.textContent = "Clues remaining: " + remaining;
}


/* =========================
   Scene 1 Transparent Prop Data
========================= */

const hallProps = [
  {
    id: "radio",
    name: "Old Radio",
    image: "images/hall/radio.png",

    left: "2%",
    top: "36%",
    width: "25%",

    clueTitle: "The Broken Radio",

    description:
      "The radio isn't plugged in, yet it keeps crackling with broken static.\n\n" +
      "A muffled voice repeats:\n" +
      "“Finish the wedding... and she may leave...”"
  },
  

  {
    id: "photo",
    name: "Torn Wedding Photo",
    image: "images/hall/photo-front.png",

    left: "66%",
    top: "20%",
    width: "9%",

    clueTitle: "Torn Wedding Photo",

    description:
      "A badly damaged old-fashioned wedding photograph.\n\n" +
      "The bride's face is covered by black scratches, and a paper talisman is stuck on the groom's face. One corner of the photo is missing."
  },

  {
    id: "invitation",
    name: "Nameless Invitation",
    image: "images/hall/invitation-front.png",

    left: "41%",
    top: "55%",
    width: "9%",

    clueTitle: "Nameless Invitation",

    description:
      "The invitation has faded, and the bride's name is not written on it.\n\n" +
      "The red thread on the cover seems to have been wound again by someone."
  }
];
const bedroomProps = [
  {
    id: "wedding-dress",
    name: "Blood-Red Wedding Dress",
    image: "images/bedroom/wedding-dress.png",
    left: "58%",
top: "13%",
width: "19%",
    description:
      "An old wedding dress hanging on a wooden rack. The front is tightly sewn shut with red thread, and something seems to be hidden inside."
  },

  {
    id: "sewing-box",
    name: "Locked Sewing Box",
    image: "images/bedroom/sewing-box.png",
    left: "2%",
top: "45%",
width: "14%",
    description:
      "An old sewing box sits on the dressing table. Red thread is wound around the lid, so it can't be opened for now."
  },

  {
    id: "scissors",
    name: "Rusty Scissors",
    image: "images/bedroom/scissors.png",
    left: "24%",
top: "55%",
width: "9%",
    description:
      "A pair of rusty old scissors, with dark red stains still on the blades."
  },

  {
    id: "diary",
    name: "Bride's Diary",
    image: "images/bedroom/diary.png",
    left: "30%",
top: "20%",
width: "14%",
    description:
      "An old diary hidden beside the dressing table. It records the bride's true identity."
  }
];
const bedroomKey = {
  id: "key",
  name: "Old Bronze Key",
  image: "images/bedroom/key.png",
  description:
    "An old bronze key hidden in the sewing box. A small piece of faded red thread is still wound around its teeth."
};
const workshopItems = {
  ledger: {
    id: "ledger",
    name: "Old Ledger",
    image: "images/workshop/ledger.png",
    left: "18%",
    top: "55%",
    width: "13%",
    description:
      "An old ledger covered in paper ash. Some entries have faded and can't be read in ordinary light."
  },

  contractBottom: {
    id: "marriage-bottom",
    name: "Lower Half of the Marriage Contract",
    image: "images/workshop/marriage-bottom.png",
    description:
      "The lower half of the marriage contract, found in the old cabinet. It can be joined with the upper half from the wedding hall."
  },

  photoFragment: {
    id: "photo-fragment",
    name: "Wedding Photo Fragment",
    image: "images/workshop/photo-fragment.png",
    description:
      "A fragment of the wedding photo found in the old cabinet. The outline of a torn-away face remains on it."
  }
};
/* =========================
   Scene 2 Paper Doll Data
========================= */

const paperDolls = [
  {
    id: "paper-doll-1",
    name: "Paper Doll One",
    image: "images/wedding/paper-doll-1.png",

  left: "28.5%",
    top: "39%",
    width: "9%",

    correctItem: "lantern",

    description:
      "The paper doll's hands are empty. A faint ring of flame patterns is drawn around its sleeve."
  },

  {
    id: "paper-doll-2",
    name: "Paper Doll Two",
    image: "images/wedding/paper-doll-2.png",

     left: "39%",
    top: "39%",
    width: "9%",

    correctItem: "cup",

    description:
      "Dark water stains mark the doll's chest, as if it was once soaked with wine."
  },

  {
    id: "paper-doll-3",
    name: "Paper Doll Three",
    image: "images/wedding/paper-doll-3.png",

  left: "50%",
    top: "39%",
    width: "9%",

    correctItem: "comb",

    description:
      "A few long, thin black lines are drawn beside the doll's collar, like scattered strands of hair."
  },

  {
    id: "paper-doll-4",
    name: "Paper Doll Four",
    image: "images/wedding/paper-doll-4.png",

     left: "60%",
    top: "39%",
    width: "9%",

    correctItem: "small-mirror",

    description:
      "An incomplete circle is drawn on the doll's chest, its surface glinting with a dull silver light."
  }
];

/* =========================
   Scene 2 Offering Data
========================= */

const offeringItems = [
  {
    id: "lantern",
    name: "Old Paper Lantern",
    image: "images/wedding/lantern.png",

    left: "23%",
    top: "57%",
    width: "6%",

    description:
      "A faded paper lantern. A faint light still lingers inside."
  },

  {
    id: "cup",
    name: "Old Wine Cup",
    image: "images/wedding/cup.png",

    left: "39%",
    top: "59%",
    width: "4%",

    description:
      "An old wine cup, with dried dark red liquid left at the bottom."
  },

  {
    id: "comb",
    name: "Broken-Toothed Wooden Comb",
    image: "images/wedding/comb.png",

    left: "54%",
    top: "60%",
    width: "6%",

    description:
      "The comb is missing several teeth, and a few long black hairs are tangled in the gaps."
  },

  {
    id: "small-mirror",
    name: "Cloudy Small Bronze Mirror",
    image: "images/wedding/small-mirror.png",

    left: "70%",
    top: "56%",
    width: "5%",

    description:
      "The mirror's surface has turned cloudy, and a blurry figure faintly appears inside."
  }
];

const candleItem = {
  id: "candle",
  name: "Extinguished Wedding Candle",
  image: "images/wedding/candle.png",

  description:
    "An old wedding candle found in the hidden compartment. The wick is out, but it still holds a little warmth."
};

const marriageTopItem = {
  id: "marriage-top",
  name: "Upper Half of the Marriage Contract",
  image: "images/wedding/marriage-top.png",
  description:
    "An old marriage contract torn in the middle. You need to find the lower half to see the full contents."
};
const allInventoryItems = [
  ...offeringItems,
  candleItem,
  bedroomKey,
  marriageTopItem,
  workshopItems.contractBottom,

  bedroomProps.find(function (prop) {
    return prop.id === "scissors";
  })
];
/* =========================
   Page Elements
========================= */

const startScreen = document.querySelector("#start-screen");
const startButton = document.querySelector("#start-button");
const playerNameInput = document.querySelector("#player-name");
const nameError = document.querySelector("#name-error");
const game = document.querySelector("#game");

const propLayer = document.querySelector("#prop-layer");
const inventoryList =
  document.querySelector("#inventory-list");
const sceneBackground =
  document.querySelector("#scene-background");
  const sceneTitle = document.querySelector("#scene-title");
const messageText = document.querySelector("#message-text");

const mapButton = document.querySelector("#map-button");
const clueButton = document.querySelector("#clue-button");
const soundButton = document.querySelector("#sound-button");
const resetButton = document.querySelector("#reset-button");

const mapPanel = document.querySelector("#map-panel");
const cluePanel = document.querySelector("#clue-panel");

const locationList = document.querySelector("#location-list");
const clueList = document.querySelector("#clue-list");

const itemModal = document.querySelector("#item-modal");
const modalImage = document.querySelector("#modal-image");
const modalTitle = document.querySelector("#modal-title");
const modalDescription = document.querySelector("#modal-description");
const modalActions = document.querySelector("#modal-actions");


/* =========================
   Save Progress
========================= */

function saveGame() {
  localStorage.setItem(
    "namelessWeddingSave",
    JSON.stringify(gameState)
  );
}

/* =========================
   Player Name Helpers
========================= */

// The name shown in the story. Falls back to "you" if none was entered.
function getPlayerName() {
  return gameState.playerName || "you";
}

// Pre-fill the name box if the player already has a saved game
if (gameState.playerName && playerNameInput) {
  playerNameInput.value = gameState.playerName;
}

if (playerNameInput) {
  playerNameInput.addEventListener("input", function () {
    nameError.classList.add("hidden");
  });

  playerNameInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      startButton.click();
    }
  });
}

function updatePlayerTag() {
  const tagName = document.querySelector("#player-tag-name");

  if (tagName) {
    tagName.textContent = gameState.playerName;
  }
}

/* =========================
   Scene Flow and Guidance
========================= */

const scenePrompt = document.querySelector("#scene-prompt");
const scenePromptText = document.querySelector("#scene-prompt-text");
const scenePromptButton = document.querySelector("#scene-prompt-button");
const mapProgress = document.querySelector("#map-progress");

// Which area comes after which
const sceneFlow = {
  hall: "wedding",
  wedding: "bedroom",
  bedroom: "workshop",
  workshop: "corridor"
};

function hasClue(clueId) {
  return gameState.clues.some(function (clue) {
    return clue.id === clueId;
  });
}

// True when everything in an area has been found and done
function isSceneComplete(sceneId) {
  switch (sceneId) {
    case "hall":
      return (
        hasClue("radio") &&
        (hasClue("photo") || hasClue("repaired-photo")) &&
        hasClue("invitation")
      );

    case "wedding":
      return (
        gameState.collectedRewards.includes("marriage-top") &&
        gameState.collectedRewards.includes("candle")
      );

    case "bedroom":
      return (
        hasClue("diary") &&
        gameState.bedroomProgress.keyCollected
      );

    case "workshop":
      return (
        gameState.workshopProgress.ledgerRevealed &&
        hasClue("marriage-contract") &&
        hasClue("repaired-photo")
      );

    case "corridor":
      return gameState.corridorProgress.ending != null;

    default:
      return false;
  }
}

function hideScenePrompt() {
  scenePrompt.classList.add("hidden");
  scenePromptButton.onclick = null;
}

function showScenePrompt(text, buttonLabel, onClick) {
  scenePromptText.textContent = text;

  if (buttonLabel && onClick) {
    scenePromptButton.textContent = buttonLabel;
    scenePromptButton.classList.remove("hidden");
    scenePromptButton.onclick = onClick;
  } else {
    scenePromptButton.classList.add("hidden");
    scenePromptButton.onclick = null;
  }

  scenePrompt.classList.remove("hidden");
}

function getLocationName(sceneId) {
  const found = locations.find(function (location) {
    return location.id === sceneId;
  });

  return found ? found.name : "";
}

// When the current area is finished: unlock the next one and point the player to it
function offerNextLocation(sceneId) {
  const nextId = sceneFlow[sceneId];

  if (
    !nextId ||
    gameState.currentScene !== sceneId ||
    !isSceneComplete(sceneId)
  ) {
    return;
  }

  if (!gameState.unlockedScenes.includes(nextId)) {
    gameState.unlockedScenes.push(nextId);
    playSfx("audio/DoorOpen.mp3");
  }

  saveGame();
  renderMap();

  showScenePrompt(
    "This area has been fully explored. Head to the next location.",
    "Go to " + getLocationName(nextId),
    function () {
      goToScene(nextId);
    }
  );
}

// Guidance for the last area, which has no "next location"
function updateCorridorPrompt() {
  if (gameState.currentScene !== "corridor") {
    return;
  }

  const progress = gameState.corridorProgress;

  if (progress.ending != null) {
    hideScenePrompt();
    return;
  }

  if (!progress.mirrorRevealed) {
    showScenePrompt(
      "Something in this corridor is watching you. Examine the bronze mirror."
    );
    return;
  }

  showScenePrompt(
    "The red door is waiting for you. Make your final choice.",
    "Approach the Door",
    inspectCorridorDoor
  );
}

// Used after the contract / photo are combined in the workshop
function closeAfterWorkshopStep() {
  closeItemModal();

  if (gameState.currentScene === "workshop") {
    renderWorkshop();
  }
}

function needsContractCombine() {
  return (
    gameState.inventory.includes("marriage-top") &&
    gameState.inventory.includes("marriage-bottom") &&
    !hasClue("marriage-contract")
  );
}

/* =========================
   Scene Unlock Check
========================= */

function checkWorkshopUnlock() {
  const hasBedroomKey =
    gameState.bedroomProgress.keyCollected ||
    gameState.inventory.includes("key");

  if (
    hasBedroomKey &&
    hasClue("diary") &&
    !gameState.unlockedScenes.includes("workshop")
  ) {
    gameState.unlockedScenes.push("workshop");
  }
}
/* =========================
   Enter the Game
========================= */

startButton.addEventListener("click", function () {
  const enteredName = playerNameInput.value.trim();

  if (!enteredName) {
    nameError.classList.remove("hidden");
    playerNameInput.focus();
    return;
  }

  gameState.playerName = enteredName;
  saveGame();
  updatePlayerTag();

  startScreen.classList.add("hidden");
  game.classList.remove("hidden");

  playSceneBgm("hall");
  renderHall();

  messageText.textContent =
    "The gate closed behind you, " + enteredName + ". " +
    "The radio on the counter suddenly crackled with static.";

  renderCluePanel();
  renderMap();
  updateSoundButton();
  renderInventory();
  checkWorkshopUnlock();
  checkWeddingRewards();
  checkMarriageContractReady();
  checkPhotoRepairReady();
});


/* =========================
   Show Scene 1
========================= */

function renderHall() {
  gameState.currentScene = "hall";
  playSceneBgm("hall");

  sceneBackground.src = "images/hall/screen1.jpg";
  sceneBackground.alt = "Mansion hall";

  sceneTitle.textContent = "Mansion Hall";

  messageText.textContent =
    "The gate closed behind you. The radio on the counter suddenly crackled with static.";

  propLayer.innerHTML = "";
  hideScenePrompt();

  hallProps.forEach(function (propData) {
    createSceneProp(propData);
  });

  saveGame();
  renderMap();
  checkHallCompletion();
  updateClueCounter();
}
function renderWeddingHall() {
  gameState.currentScene = "wedding";
  playSceneBgm("wedding");

  sceneBackground.src = "images/wedding/screen2.jpg";
  sceneBackground.alt = "Empty wedding hall";

  sceneTitle.textContent = "Empty Wedding Hall";

  messageText.textContent =
    "Four paper dolls stand with empty hands, and a few wedding items are scattered across the table.";

  propLayer.innerHTML = "";
  hideScenePrompt();

  paperDolls.forEach(function (dollData) {
  createPaperDoll(dollData);

  const isSolved =
    gameState.solvedDolls.includes(dollData.id);

  if (isSolved) {
    createPlacedOffering(dollData);
  }
});

  offeringItems.forEach(function (itemData) {
    const alreadyCollected =
  gameState.inventory.includes(itemData.id);

const alreadyUsed =
  gameState.usedItems.includes(itemData.id);

if (!alreadyCollected && !alreadyUsed) {
  createOfferingItem(itemData);
}
  });
  if (
  gameState.solvedDolls.length ===
  paperDolls.length
) {
  createWeddingRewards();
}

  renderInventory();
  saveGame();
  renderMap();
  checkWeddingRewards();
  updateClueCounter();
}
function renderBedroom() {
  gameState.currentScene = "bedroom";
  playSceneBgm("bedroom");

  sceneBackground.src =
    "images/bedroom/screen3.jpg";

  sceneBackground.alt = "Bride's bedroom";
  sceneTitle.textContent = "Bride's Bedroom";

  messageText.textContent =
    "No one is in the bedroom, yet the dress on the rack looks as if someone just wore it.";

  propLayer.innerHTML = "";
  hideScenePrompt();

 bedroomProps.forEach(function (propData) {
  const scissorsCollected =
    propData.id === "scissors" &&
    gameState.bedroomProgress.scissorsCollected;

  const diaryCollected =
    propData.id === "diary" &&
    gameState.bedroomProgress.diaryCollected;

  if (!scissorsCollected && !diaryCollected) {
    createBedroomProp(propData);
  }
});

  renderInventory();
  saveGame();
  renderMap();
  checkBedroomCompletion();
  updateClueCounter();
}
function renderWorkshop() {
  gameState.currentScene = "workshop";
  playSceneBgm("workshop");

  sceneBackground.src =
    "images/workshop/screen4.jpg";

  sceneBackground.alt = "Backyard paper workshop";
  sceneTitle.textContent = "Backyard Workshop";

  messageText.textContent =
    "The workshop is piled with unfinished paper dolls. A locked old cabinet is hidden behind the workbench.";

  propLayer.innerHTML = "";
  hideScenePrompt();
createWorkshopLedger();

if (gameState.workshopProgress.cabinetOpened) {
  createWorkshopCabinetRewards();
} else {
  createWorkshopCabinetHotspot();
}
 renderInventory();
checkWorkshopCompletion();
saveGame();
renderMap();
updateClueCounter();
}
function checkWorkshopCompletion() {
  // Remind the player to combine the contract and repair the photo
  checkMarriageContractReady();
  checkPhotoRepairReady();

  offerNextLocation("workshop");
}

function renderCorridor() {
  gameState.currentScene = "corridor";
  playSceneBgm("corridor");

  sceneBackground.src =
    "images/corridor/screen5.jpg";

  sceneBackground.alt = "Return corridor";
  sceneTitle.textContent = "Return Corridor";

  messageText.textContent =
    "White lamps light an endless corridor. At the far end, a red door stays tightly shut.";

  propLayer.innerHTML = "";
  hideScenePrompt();
  createCorridorMirror();
  createCorridorDoor();
  updateCorridorPrompt();
  renderInventory();
  saveGame();
  renderMap();
  updateClueCounter();
}
function createCorridorMirror() {
  const mirror = document.createElement("img");

  mirror.src =
    "images/corridor/bronze-mirror.png";

  mirror.alt = "Corridor bronze mirror";
  mirror.title = "Corridor bronze mirror";

  mirror.classList.add(
    "scene-prop",
    "corridor-prop"
  );

  mirror.style.left = "6%";
mirror.style.top = "12%";
mirror.style.width = "14%";

  mirror.addEventListener("click", function () {
    inspectCorridorMirror();
  });

  propLayer.appendChild(mirror);
}

function createCorridorDoor() {
  const door = document.createElement("img");

  door.src =
    "images/corridor/red-door.png";

  door.alt = "Red wooden door";
  door.title = "Red wooden door";

  door.classList.add(
    "scene-prop",
    "corridor-prop"
  );

  door.style.left = "41%";
  door.style.top = "20%";
  door.style.width = "20%";

door.addEventListener("click", function () {
  inspectCorridorDoor();
});

propLayer.appendChild(door);
}

function inspectCorridorMirror() {
  gameState.corridorProgress.mirrorRevealed = true;

  // Play Bridenarrative.mp3 (max volume 1.0)
  if (!gameState.corridorProgress.narrativePlayed) {
    gameState.corridorProgress.narrativePlayed = true;
    playSfx("audio/Bridenarrative.mp3", false, null, 1.0);
  }

  saveGame();
  updateClueCounter();

  openModal({
    title: "Corridor Bronze Mirror",
    image: "images/corridor/bronze-mirror.png",
    description:
      "A faceless bride slowly appears in the glass. She raises her hand and writes in the mirror: Give me back my name.",
    actions: [
      {
        label: "Remember the Truth",
        action: function () {
          closeItemModal();
          updateCorridorPrompt();
        }
      }
    ]
  });
}

function inspectCorridorDoor() {
  if (!gameState.corridorProgress.mirrorRevealed) {
    openModal({
      title: "The Sealed Red Door",
      image: "images/corridor/red-door.png",
      description:
        "The red door is held shut by an unseen force. The bronze mirror in the corridor seems to be watching you.",
      actions: [
        {
          label: "Close",
          action: closeItemModal
        }
      ]
    });

    return;
  }

  if (
    gameState.corridorProgress.ending === "truth"
  ) {
    showTruthEnding();
    return;
  }

  if (
    gameState.corridorProgress.ending === "substitute"
  ) {
    showSubstituteEnding();
    return;
  }

  openModal({
    title: "The Final Choice",
    image: "images/corridor/red-door.png",
    description:
      getPlayerName() +
      ", are you sure you want to open this door?\n\nThe seal on the red door has loosened. You must decide how to end this nameless wedding.",
    actions: [
      {
        label: "Return the Bride's Name",
        action: attemptTruthEnding
      },
      {
        label: "Follow the Radio and Speak Your Name",
        action: showSubstituteEnding
      },
      {
        label: "Think Again",
        action: closeItemModal
      }
    ]
  });openModal({
  title: "The Final Choice",
  image: "images/corridor/red-door.png",
  description:
    getPlayerName() +
    ", the red door begins to open.\n\n" +
    "The bride asks you to return her forgotten name. " +
    "At the same time, the radio crackles behind you: " +
    "“Finish the wedding... and she may leave...”\n\n" +
    "You must decide how the ceremony will end.",
  actions: [
    {
      label: "Return the Bride's Name",
      action: attemptTruthEnding
    },
    {
      label: "Trust the Radio: Finish the Wedding",
      action: confirmSubstituteEnding
    },
    {
      label: "Think Again",
      action: closeItemModal
    }
  ]
});
}

function confirmSubstituteEnding() {
  openModal({
    title: "Finish the Wedding",
    image: "images/corridor/red-door.png",
    description:
      "The radio whispers your name.\n\n“" +
      getPlayerName() +
      ", complete the ceremony and set her free.”\n\n" +
      "Will you finish the wedding?",
    actions: [
      {
        label: "Complete the Ceremony",
        action: showSubstituteEnding
      },
      {
        label: "Go Back",
        action: inspectCorridorDoor
      }
    ]
  });
}
function attemptTruthEnding() {
 const requiredClues = [
  "diary",
  "ledger",
  "marriage-contract",
  "repaired-photo"
];

  const hasAllClues =
    requiredClues.every(function (clueId) {
      return gameState.clues.some(function (clue) {
        return clue.id === clueId;
      });
    });

  const redThreadCut =
    gameState.bedroomProgress.dressCut;

  if (!hasAllClues || !redThreadCut) {
    openModal({
      title: "The Truth Is Incomplete",
      image:
        "images/corridor/bronze-mirror.png",
      description:
        "You want to return her name, but you can't prove who she really was. Perhaps the diary or some other clue is still missing.",
      actions: [
        {
          label: "Keep Investigating",
          action: closeItemModal
        }
      ]
    });

    return;
  }

  showTruthEnding();
}

function showTruthEnding() {
  gameState.corridorProgress.ending = "truth";
  hideScenePrompt();
  playSfx(endingSounds.truth, false, null, 1.0);

  saveGame();

  openModal({
    title: "Ending A: The Name Returned",
    image:
      "images/corridor/bronze-mirror.png",
    description:
      "You piece together the diary, the marriage contract, and the ledger records, and speak the bride's true name aloud.\n\nThe red threads on the wedding dress snap for good, and the bride in the mirror finally shows her whole face. The red door slowly opens. She doesn't look back, only leaves one line behind: “This time, I am no one's substitute.”\n\nYou step through the red door and out of the mansion, still carrying your own name, " +
      getPlayerName() +
      ".",
    actions: [
      {
        label: "Investigate Again",
        action: restartInvestigation
      }
    ]
  });
}

function showSubstituteEnding() {
  gameState.corridorProgress.ending =
    "substitute";
  hideScenePrompt();

  // Cut the music so the failure sound lands harder
  bgmAudio.pause();
  playSfx(endingSounds.substitute, false, null, 1.0);

  saveGame();

  openModal({
    title: "Ending B: The Substitute Bride",
    image: "images/corridor/red-door.png",
    description:
      "You trusted the voice on the radio. Standing before the red door, you spoke your own name aloud: “" +
      getPlayerName() +
      ".”\n\nThe blank on the marriage contract trembles, and the ink slowly rewrites itself. The new name reads: " +
      getPlayerName() +
      ".\n\nIn the mirror, the faceless bride lifts her veil and lays it over your head. The red door swings open, but what walks through it is no longer you. From now on, you are the next nameless bride.",
    actions: [
      {
        label: "Investigate Again",
        action: restartInvestigation
      }
    ]
  });
}

function restartInvestigation() {
  localStorage.removeItem(
    "namelessWeddingSave"
  );

  window.location.reload();
}

function createBedroomProp(propData) {
  const prop = document.createElement("img");

  prop.src = propData.image;
  prop.alt = propData.name;
  prop.title = propData.name;

  prop.classList.add(
    "scene-prop",
    "bedroom-prop"
  );

  prop.style.left = propData.left;
  prop.style.top = propData.top;
  prop.style.width = propData.width;

  prop.dataset.propId = propData.id;

  prop.addEventListener("click", function () {
    inspectBedroomProp(propData);
  });

  propLayer.appendChild(prop);
}
  function inspectBedroomProp(propData) {
  // Scissors
  if (propData.id === "scissors") {
    openModal({
      title: propData.name,
      image: propData.image,
      description: propData.description,
      actions: [
        {
          label: "Pick Up",
          action: function () {
            collectBedroomScissors(propData);
          }
        },
        {
          label: "Close",
          action: closeItemModal
        }
      ]
    });

    return;
  }

  // Diary
  if (propData.id === "diary") {
    playSfx("audio/PageTurn.mp3");
    openModal({
      title: propData.name,
      image: propData.image,
      description:
        propData.description +
        "\n\nThe diary reads: “What they need isn't a bride, only a substitute.”",
      actions: [
        {
          label: "Take the Clue",
          action: function () {
            collectBedroomDiary(propData);
          }
        },
        {
          label: "Close",
          action: closeItemModal
        }
      ]
    });

    return;
  }

  // Wedding dress
  if (propData.id === "wedding-dress") {
    if (gameState.bedroomProgress.dressCut) {
      openModal({
        title: "The Cut Wedding Dress",
        image: propData.image,
        description:
          "The red threads on the dress have been cut. A line is embroidered on the inside of the front: “Return the name, and the dead may rest.”",
        actions: [
          {
            label: "Close",
            action: closeItemModal
          }
        ]
      });

      return;
    }

    if (selectedItemId !== "scissors") {
      openModal({
        title: propData.name,
        image: propData.image,
        description:
          propData.description +
          "\n\nThe red threads are extremely tough. Perhaps you should select the scissors from your inventory first.",
        actions: [
          {
            label: "Close",
            action: closeItemModal
          }
        ]
      });

      return;
    }

    openModal({
      title: propData.name,
      image: propData.image,
      description:
        "You reach the scissors toward the dress. The red threads tremble slightly, as if alive.",
      actions: [
        {
          label: "Cut the Red Threads",
          action: function () {
            playSfx("audio/Scissor.mp3", false, 7);
            cutWeddingDress();
          }
        },
        {
          label: "Close",
          action: closeItemModal
        }
      ]
    });

    return;
  }

  // Sewing box
  if (propData.id === "sewing-box") {
    if (!gameState.bedroomProgress.dressCut) {
      openModal({
        title: propData.name,
        image: propData.image,
        description:
          "The sewing box is tightly bound with red thread and can't be opened yet.",
        actions: [
          {
            label: "Close",
            action: closeItemModal
          }
        ]
      });

      return;
    }

    if (gameState.bedroomProgress.keyCollected) {
      openModal({
        title: "Empty Sewing Box",
        image: propData.image,
        description:
          "The sewing box has been opened. There's nothing left inside.",
        actions: [
          {
            label: "Close",
            action: closeItemModal
          }
        ]
      });

      return;
    }

    openModal({
      title: propData.name,
      image: propData.image,
      description:
        "The red thread has snapped. You lift the lid gently, and an old bronze key lies hidden inside.",
      actions: [
        {
          label: "Take the Key",
          action: collectBedroomKey
        },
        {
          label: "Close",
          action: closeItemModal
        }
      ]
    });

    return;
  }
}
function collectBedroomScissors(propData) {
  gameState.bedroomProgress.scissorsCollected = true;

  if (!gameState.inventory.includes(propData.id)) {
    gameState.inventory.push(propData.id);
  }

  selectedItemId = propData.id;

  messageText.textContent =
    "Item obtained: " + propData.name;

  saveGame();
  closeItemModal();
  renderInventory();
  renderBedroom();
  updateClueCounter();
}
function collectBedroomDiary(propData) {
  gameState.bedroomProgress.diaryCollected = true;

  const alreadyInClues =
    gameState.clues.some(function (clue) {
      return clue.id === propData.id;
    });

  if (!alreadyInClues) {
    gameState.clues.push({
      id: propData.id,
      name: propData.name,
      image: propData.image,
      description:
        "The diary records that this wedding doesn't need a real bride, only a substitute to complete the ritual in place of the dead."
    });
  }

  messageText.textContent =
    "Clue found: " + propData.name;

  saveGame();
  closeItemModal();
  renderCluePanel();
  renderBedroom();
  updateClueCounter();
}
function cutWeddingDress() {
  gameState.bedroomProgress.dressCut = true;
  gameState.inventory =
  gameState.inventory.filter(function (itemId) {
    return itemId !== "scissors";
  });

if (!gameState.usedItems.includes("scissors")) {
  gameState.usedItems.push("scissors");
}
  selectedItemId = null;

  saveGame();
  closeItemModal();
  renderInventory();
  renderBedroom();

  messageText.textContent =
    "The red threads are cut. A hidden line of text appears inside the dress.";
}

function collectBedroomKey() {
  gameState.bedroomProgress.keyCollected = true;

  if (!gameState.inventory.includes("key")) {
    gameState.inventory.push("key");
  }
  
  selectedItemId = null;

  saveGame();
  closeItemModal();
  renderInventory();
  renderBedroom();
  renderMap();
  updateClueCounter();

  messageText.textContent =
    "Item obtained: Old Bronze Key. It may open a locked cabinet somewhere.";
}

function createOfferingItem(itemData) {
  const item = document.createElement("img");

  item.src = itemData.image;
  item.alt = itemData.name;
  item.title = itemData.name;

  item.classList.add(
    "scene-prop",
    "offering-item"
  );

  item.style.left = itemData.left;
  item.style.top = itemData.top;
  item.style.width = itemData.width;

  item.dataset.itemId = itemData.id;

  item.addEventListener("click", function () {
    inspectOfferingItem(itemData);
  });

  propLayer.appendChild(item);
}


function inspectOfferingItem(itemData) {
  openModal({
    title: itemData.name,
    image: itemData.image,
    description: itemData.description,

    actions: [
      {
        label: "Pick Up",
        action: function () {
          collectInventoryItem(itemData);
        }
      },

      {
        label: "Close",
        action: closeItemModal
      }
    ]
  });
}


function collectInventoryItem(itemData) {
  const alreadyCollected =
    gameState.inventory.includes(itemData.id);

  if (!alreadyCollected) {
    gameState.inventory.push(itemData.id);
  }

  selectedItemId = itemData.id;

  messageText.textContent =
    "Item obtained: " + itemData.name;

  saveGame();
  renderInventory();
  closeItemModal();
  renderWeddingHall();
}

function renderInventory() {
  inventoryList.innerHTML = "";

  if (gameState.inventory.length === 0) {
    return;
  }

  gameState.inventory.forEach(function (itemId) {
    const itemData = allInventoryItems.find(
      function (item) {
        return item.id === itemId;
      }
    );

    if (!itemData) {
      return;
    }

    const slot = document.createElement("button");

    slot.type = "button";
    slot.classList.add("inventory-slot");
    slot.title = itemData.name;

    if (selectedItemId === itemId) {
      slot.classList.add("selected");
    }

    const image = document.createElement("img");

    image.src = itemData.image;
    image.alt = itemData.name;

    slot.appendChild(image);

    slot.addEventListener("click", function () {
      selectInventoryItem(itemId);
    });

    inventoryList.appendChild(slot);
  });
}


function selectInventoryItem(itemId) {
  if (selectedItemId === itemId) {
    selectedItemId = null;

    messageText.textContent =
      "Item deselected.";

    renderInventory();
    return;
  }

  selectedItemId = itemId;

  const itemData = allInventoryItems.find(
    function (item) {
      return item.id === itemId;
    }
  );

  if (!itemData) {
    messageText.textContent =
      "Item selected.";

    renderInventory();
    return;
  }

  // The four offerings in Scene 2
  const isOffering = offeringItems.some(
    function (item) {
      return item.id === itemId;
    }
  );

  if (
    gameState.currentScene === "wedding" &&
    isOffering
  ) {
    messageText.textContent =
      "Selected: " + itemData.name +
      ". Choose a paper doll to give it to.";
  }

  // The scissors in Scene 3
  else if (
    gameState.currentScene === "bedroom" &&
    itemId === "scissors"
  ) {
    messageText.textContent =
      "Selected: Scissors. Now click the wedding dress to try cutting the red threads.";
  }

  // Other items
  else {
    messageText.textContent =
      "Selected: " + itemData.name +
      ". Look for a place in the scene where you can use it.";
  }

  renderInventory();
}

function createPaperDoll(dollData) {
  const doll = document.createElement("img");

  doll.src = dollData.image;
  doll.alt = dollData.name;
  doll.title = dollData.name;

  doll.classList.add(
    "scene-prop",
    "paper-doll"
  );

  doll.style.left = dollData.left;
  doll.style.top = dollData.top;
  doll.style.width = dollData.width;

  doll.dataset.dollId = dollData.id;
  if (
  gameState.solvedDolls.includes(dollData.id)
) {
  doll.classList.add("solved");
}

  doll.addEventListener("click", function () {
    inspectPaperDoll(dollData);
  });

  propLayer.appendChild(doll);
}


function inspectPaperDoll(dollData) {
  const isSolved =
    gameState.solvedDolls.includes(dollData.id);

  if (isSolved) {
    openModal({
      title: dollData.name,
      image: dollData.image,

      description:
        "The paper doll has accepted its offering and stiffly lowered its head.",

      actions: [
        {
          label: "Close",
          action: closeItemModal
        }
      ]
    });

    return;
  }

  if (!selectedItemId) {
    openModal({
      title: dollData.name,
      image: dollData.image,

      description:
        dollData.description +
        "\n\nIts hands are empty, as if waiting for something.\n\n" +
        "First select an offering from the inventory bar at the bottom.",

      actions: [
        {
          label: "Close",
          action: closeItemModal
        }
      ]
    });

    return;
  }

  giveItemToPaperDoll(dollData);
}

function giveItemToPaperDoll(dollData) {
  const selectedItem = offeringItems.find(
    function (item) {
      return item.id === selectedItemId;
    }
  );

  if (!selectedItem) {
    return;
  }

  if (selectedItemId !== dollData.correctItem) {
    openModal({
      title: "Wrong Offering",
      image: selectedItem.image,

      description:
        "The paper doll's head turns toward you.\n\n" +
        "It won't take this item. The offering seems to be wrong.",

      actions: [
        {
          label: "Take It Back",
          action: closeItemModal
        }
      ]
    });

    messageText.textContent =
      "The paper doll refused the offering.";

    return;
  }

  const solvedItemId = selectedItemId;

  gameState.solvedDolls.push(dollData.id);
  gameState.usedItems.push(solvedItemId);

  gameState.inventory =
    gameState.inventory.filter(
      function (itemId) {
        return itemId !== solvedItemId;
      }
    );

  selectedItemId = null;

  saveGame();
  renderInventory();
  renderWeddingHall();
  updateClueCounter();

  openModal({
    title: "Offering Placed",
    image: selectedItem.image,

    description:
      "The paper doll slowly raises its hands and takes the " +
      selectedItem.name +
      ".\n\nA low scrape of wood sounds from somewhere in the hall.",

    actions: [
      {
        label: "Keep Investigating",
        action: closeItemModal
      }
    ]
  });

  checkPaperDollPuzzle();
}
const placedOfferingPositions = {
  "paper-doll-1": {
    left: "31.5%",
    top: "53%",
    width: "4%"
  },

  "paper-doll-2": {
    left: "42%",
    top: "54%",
    width: "3%"
  },

  "paper-doll-3": {
    left: "53%",
    top: "54%",
    width: "4%"
  },

  "paper-doll-4": {
    left: "63%",
    top: "52%",
    width: "3.5%"
  }
};


function createPlacedOffering(dollData) {
  const itemData = allInventoryItems.find(
    function (item) {
      return item.id === dollData.correctItem;
    }
  );

  const position =
    placedOfferingPositions[dollData.id];

  if (!itemData || !position) {
    return;
  }

  const placedItem = document.createElement("img");

  placedItem.src = itemData.image;
  placedItem.alt = itemData.name;

  placedItem.classList.add("placed-offering");

  placedItem.style.left = position.left;
  placedItem.style.top = position.top;
  placedItem.style.width = position.width;

  propLayer.appendChild(placedItem);
  
}
function createWeddingRewards() {
  const contractCollected =
    gameState.collectedRewards.includes(
      "marriage-top"
    );

  const candleCollected =
    gameState.collectedRewards.includes(
      "candle"
    );

  if (!contractCollected) {
    createWeddingReward({
      id: "marriage-top",
      name: "Upper Half of the Marriage Contract",

      image:
        "images/wedding/marriage-top.png",

      left: "43%",
      top: "64%",
      width: "12%",

      description:
        "An old marriage contract torn in the middle. The names and dates on it have blurred."
    });
  }

  if (!candleCollected) {
    createWeddingReward({
      id: "candle",
      name: "Extinguished Wedding Candle",

      image: "images/wedding/candle.png",

      left: "57%",
      top: "66%",
      width: "5%",

      description:
        "A wedding candle that has burned out, though the wick still holds some warmth."
    });
  }
}


function createWeddingReward(rewardData) {
  const reward = document.createElement("img");

  reward.src = rewardData.image;
  reward.alt = rewardData.name;
  reward.title = rewardData.name;

  reward.classList.add(
    "scene-prop",
    "wedding-reward"
  );

  reward.style.left = rewardData.left;
  reward.style.top = rewardData.top;
  reward.style.width = rewardData.width;

  reward.addEventListener("click", function () {
    inspectWeddingReward(rewardData);
  });

  propLayer.appendChild(reward);
}


function inspectWeddingReward(rewardData) {
  if (rewardData.id === "marriage-top") {
    playSfx("audio/PageTurn.mp3");
  }

  openModal({
    title: rewardData.name,
    image: rewardData.image,
    description: rewardData.description,

    actions: [
      {
        label: "Take It",
        action: function () {
          collectWeddingReward(rewardData);
        }
      },

      {
        label: "Close",
        action: closeItemModal
      }
    ]
  });
}


function collectWeddingReward(rewardData) {
  const alreadyCollected =
    gameState.collectedRewards.includes(
      rewardData.id
    );

  if (!alreadyCollected) {
    gameState.collectedRewards.push(
      rewardData.id
    );
  }

  if (
    rewardData.id === "candle" &&
    !gameState.inventory.includes("candle")
  ) {
    gameState.inventory.push("candle");
  }

if (
  rewardData.id === "marriage-top" &&
  !gameState.inventory.includes("marriage-top")
) {
  gameState.inventory.push("marriage-top");
}
  saveGame();
  closeItemModal();

  renderInventory();
  renderCluePanel();
  renderWeddingHall();

  messageText.textContent =
    "Obtained: " + rewardData.name;

  checkWeddingRewards();
}


function checkWeddingRewards() {
  offerNextLocation("wedding");
}
function checkPaperDollPuzzle() {
  if (
    gameState.solvedDolls.length <
    paperDolls.length
  ) {
    return;
  }

  playSfx("audio/Mechanical.mp3");

  messageText.textContent =
    "All four offerings are in place. A mechanism clicks open beneath the banquet table.";

  openModal({
    title: "Hidden Compartment Under the Table",

    image:
      "images/wedding/marriage-top.png",

    description:
      "All four paper dolls lower their heads at once.\n\n" +
      "The compartment beneath the banquet table slowly opens, and inside seem to be a torn marriage contract and an extinguished wedding candle.",

    actions: [
      {
        label: "Look Inside",
        action: closeItemModal
      }
    ]
  });
}

function checkBedroomCompletion() {
  offerNextLocation("bedroom");
}

/* =========================
   Create Transparent Interactive Props
========================= */

function createSceneProp(propData) {
  const prop = document.createElement("img");

  prop.src = propData.image;
  prop.alt = propData.name;
  prop.title = propData.name;

  prop.classList.add("scene-prop");

  prop.style.left = propData.left;
  prop.style.top = propData.top;
  prop.style.width = propData.width;

  prop.dataset.propId = propData.id;

  prop.addEventListener("click", function () {
    handlePropClick(propData);
  });

  propLayer.appendChild(prop);
}


/* =========================
   Prop Clicks
========================= */

function handlePropClick(propData) {
  collectClue(propData);

  if (propData.id === "radio") {
    playRadioEffects();
    openRadioModal(propData);
  }

  if (propData.id === "photo") {
    playSfx("audio/PageTurn.mp3");
    openPhotoModal(propData);
  }

  if (propData.id === "invitation") {
    playSfx("audio/PageTurn.mp3");
    openInvitationModal(propData);
  }

  checkHallCompletion();
  updateClueCounter();
}


/* =========================
   Collect Clues
========================= */

function collectClue(propData) {
  const alreadyCollected = gameState.clues.some(
    function (clue) {
      return clue.id === propData.id;
    }
  );

  if (!alreadyCollected) {
    gameState.clues.push({
      id: propData.id,
      name: propData.clueTitle,
      image: propData.image,
      description: propData.description
    });

    messageText.textContent =
      "Clue found: " + propData.clueTitle;

    saveGame();
    renderCluePanel();
    updateClueCounter();
  }
}


/* =========================
   Radio Modal
========================= */

function openRadioModal(propData) {
  openModal({
    title: propData.clueTitle,
    image: propData.image,
    description: propData.description,

    actions: [
      {
        label: "Close",
        action: closeItemModal
      }
    ]
  });
}


/* =========================
   Wedding Photo Modal
========================= */

function openPhotoModal(propData) {
  openModal({
    title: "Torn Wedding Photo, Front",
    image: "images/hall/photo-front.png",
    description:
      "In the photo, the groom and bride sit side by side in the wedding hall.\n\n" +
      "The bride's face is scratched out, a paper talisman is stuck on the groom's face, and a piece is missing from the lower right corner.",

    actions: [
      {
        label: "Turn to Back",
        action: function () {
          playSfx("audio/PageTurn.mp3");
          showPhotoBack();
        }
      },

      {
        label: "Close",
        action: closeItemModal
      }
    ]
  });
}


function showPhotoBack() {
  openModal({
    title: "Torn Wedding Photo, Back",
    image: "images/hall/photo-back.png",
    description:
      "A faded warning is written on the back of the photo:\n\n" +
      "“Don't take my place. Give me back my name.”",

    actions: [
      {
        label: "Turn to Front",
        action: function () {
          playSfx("audio/PageTurn.mp3");
          openPhotoFrontAgain();
        }
      },

      {
        label: "Close",
        action: closeItemModal
      }
    ]
  });
}


function openPhotoFrontAgain() {
  const photoData = hallProps.find(
    function (prop) {
      return prop.id === "photo";
    }
  );

  openPhotoModal(photoData);
}


/* =========================
   Invitation Modal
========================= */

function openInvitationModal(propData) {
  openModal({
    title: "Nameless Invitation, Cover",
    image: "images/hall/invitation-front.png",
    description:
      "The cover of the invitation has badly faded.\n\n" +
      "A dark red thread is wound around the seal.",

    actions: [
      {
        label: "Open the Invitation",
        action: function () {
          playSfx("audio/PageTurn.mp3");
          showInvitationOpen();
        }
      },

      {
        label: "View the Back",
        action: function () {
          playSfx("audio/PageTurn.mp3");
          showInvitationBack();
        }
      },

      {
        label: "Close",
        action: closeItemModal
      }
    ]
  });
}


function showInvitationOpen() {
  openModal({
    title: "Nameless Invitation, Inside",
    image: "images/hall/invitation-open.png",
    description:
      "The bride's name on the invitation is completely covered by ink.\n\n" +
      "Beside it are four blurred symbols: a lantern, a cup, a comb, and a mirror.",

    actions: [
      {
        label: "View the Back",
        action: function () {
          playSfx("audio/PageTurn.mp3");
          showInvitationBack();
        }
      },

      {
        label: "Close the Invitation",
        action: function () {
          playSfx("audio/PageTurn.mp3");
          openInvitationAgain();
        }
      },

      {
        label: "Close",
        action: closeItemModal
      }
    ]
  });
}


function showInvitationBack() {
  openModal({
    title: "Nameless Invitation, Back",
    image: "images/hall/invitation-back.png",
    description:
      "A line of faded small writing is left on the back of the invitation:\n\n" +
      "“Each guest of the bridal party carries a gift. When the four gifts are in place, the wedding hall will open.”",

    actions: [
      {
        label: "Open the Invitation",
        action: function () {
          playSfx("audio/PageTurn.mp3");
          showInvitationOpen();
        }
      },

      {
        label: "Close",
        action: closeItemModal
      }
    ]
  });
}


function openInvitationAgain() {
  const invitationData = hallProps.find(
    function (prop) {
      return prop.id === "invitation";
    }
  );

  openInvitationModal(invitationData);
}


/* =========================
   General Modal
========================= */

function openModal(modalData) {
  modalTitle.textContent = modalData.title;
  if (modalData.image) {
  modalImage.src = modalData.image;
  modalImage.alt = modalData.title;
  modalImage.classList.remove("hidden");
} else {
  modalImage.removeAttribute("src");
  modalImage.alt = "";
  modalImage.classList.add("hidden");
}
  modalDescription.textContent = modalData.description;

  modalActions.innerHTML = "";

  modalData.actions.forEach(function (actionData) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = actionData.label;

    button.addEventListener(
      "click",
      actionData.action
    );

    modalActions.appendChild(button);
  });

  itemModal.classList.remove("hidden");
  itemModal.setAttribute("aria-hidden", "false");
}


function closeItemModal() {
  stopRadioEffects();
  itemModal.classList.add("hidden");
  itemModal.setAttribute("aria-hidden", "true");
}


/* =========================
   Check Whether Scene 1 Is Complete
========================= */

function checkHallCompletion() {
  offerNextLocation("hall");
}


/* =========================
   Clue Panel
========================= */

function renderCluePanel() {
  clueList.innerHTML = "";

  if (gameState.clues.length === 0) {
    const emptyMessage = document.createElement("p");

    emptyMessage.classList.add("empty-message");
    emptyMessage.textContent = "No clues found yet.";

    clueList.appendChild(emptyMessage);
    return;
  }

  gameState.clues.forEach(function (clue) {
    const clueCard = document.createElement("button");

    clueCard.type = "button";
    clueCard.classList.add("clue-card");

    clueCard.textContent = clue.name;

    clueCard.addEventListener("click", function () {
      openSavedClue(clue);
    });

    clueList.appendChild(clueCard);
  });
}

function checkMarriageContractReady() {
  const hasTop =
    gameState.inventory.includes(
      "marriage-top"
    );

  const hasBottom =
    gameState.inventory.includes(
      "marriage-bottom"
    );

  const alreadyCombined =
    gameState.clues.some(function (clue) {
      return clue.id === "marriage-contract";
    });

  if (
    !hasTop ||
    !hasBottom ||
    alreadyCombined
  ) {
    return;
  }

  openModal({
    title: "Two Torn Contract Halves",
    image:
      "images/workshop/marriage-contract.png",
    description:
      "The edges of the two contract pieces match perfectly. You can join them together now.",
    actions: [
      {
        label: "Join the Contract",
        action: function () {
          playSfx("audio/PageTurn.mp3");
          combineMarriageContract();
        }
      },
      {
        label: "Later",
        action: closeItemModal
      }
    ]
  });
}

function combineMarriageContract() {
  gameState.inventory =
    gameState.inventory.filter(
      function (itemId) {
        return (
          itemId !== "marriage-top" &&
          itemId !== "marriage-bottom"
        );
      }
    );

  const alreadyCombined =
    gameState.clues.some(function (clue) {
      return clue.id === "marriage-contract";
    });

  if (!alreadyCombined) {
    gameState.clues.push({
      id: "marriage-contract",
      name: "Complete Marriage Contract",
      image:
        "images/workshop/marriage-contract.png",
      description:
        "The complete contract proves that the bride's name was deliberately erased, and that she was written into this ritual as a substitute."
    });
  }

  selectedItemId = null;

  saveGame();
  closeItemModal();
  renderInventory();
  renderCluePanel();
  updateClueCounter();

  messageText.textContent =
    "The contract is joined. The complete marriage contract has been added to your clues.";

  openModal({
    title: "Complete Marriage Contract",
    image:
      "images/workshop/marriage-contract.png",
    description:
      "The two fragments fit together seamlessly. The hidden details of the ritual are finally visible in full.",
    actions: [
      {
        label: "Keep the Full Clue",
        action: closeAfterWorkshopStep
      }
    ]
  });
}
function checkPhotoRepairReady() {
  const hasPhoto =
    gameState.clues.some(function (clue) {
      return clue.id === "photo";
    });

  const hasFragment =
    gameState.clues.some(function (clue) {
      return clue.id === "photo-fragment";
    });

  const alreadyRepaired =
    gameState.clues.some(function (clue) {
      return clue.id === "repaired-photo";
    });

  if (
    !hasPhoto ||
    !hasFragment ||
    alreadyRepaired
  ) {
    return;
  }

  // Join the contract first, then repair the photo
  if (needsContractCombine()) {
    return;
  }

  openModal({
    title: "Torn Wedding Photo",
    image: "images/hall/photo-front.png",
    description:
      "The fragment found in the old cabinet fits the lower right corner of the torn wedding photo perfectly.",
    actions: [
      {
        label: "Repair the Photo",
        action: function () {
          playSfx("audio/PageTurn.mp3");
          repairWeddingPhoto();
        }
      },
      {
        label: "Later",
        action: closeItemModal
      }
    ]
  });
}

function repairWeddingPhoto() {
  gameState.clues =
    gameState.clues.filter(function (clue) {
      return (
        clue.id !== "photo" &&
        clue.id !== "photo-fragment"
      );
    });

  gameState.clues.push({
    id: "repaired-photo",
    name: "Repaired Wedding Photo",
    image: "images/workshop/photo-repaired.png",
    description:
      "The missing corner of the wedding photo has been put back. The date on its back matches the marriage contract exactly, proving they belong to the same ritual."
  });

  saveGame();
  closeItemModal();
  renderCluePanel();
  updateClueCounter();

  messageText.textContent =
    "The wedding photo is repaired and added to your clues.";

  openModal({
    title: "Repaired Wedding Photo",
    image:
      "images/workshop/photo-repaired.png",
    description:
      "The photo fragment slips seamlessly back into place, and a buried record of the wedding is whole again.",
    actions: [
      {
        label: "Keep the Full Clue",
        action: closeAfterWorkshopStep
      }
    ]
  });
}
function openSavedClue(clue) {
  const originalProp = hallProps.find(function (prop) {
    return prop.id === clue.id;
  });

  if (originalProp) {
    handlePropClick(originalProp);
    return;
  }

  playSfx("audio/PageTurn.mp3");
  openModal({
    title: clue.name,
    image: clue.image || "images/workshop/photo-repaired.png",
    description: clue.description,

    actions: [
      {
        label: "Close",
        action: closeItemModal
      }
    ]
  });
}


/* =========================
   Map Panel
========================= */

const locations = [
  {
    id: "hall",
    name: "Mansion Hall"
  },

  {
    id: "wedding",
    name: "Empty Wedding Hall"
  },

  {
    id: "bedroom",
    name: "Bride's Bedroom"
  },

  {
    id: "workshop",
    name: "Backyard Workshop"
  },

  {
    id: "corridor",
    name: "Return Corridor"
  }
];


function renderMap() {
  if (!gameState.visitedScenes.includes(gameState.currentScene)) {
    gameState.visitedScenes.push(gameState.currentScene);
  }

  locationList.innerHTML = "";

  const exploredCount = locations.filter(function (location) {
    return isSceneComplete(location.id);
  }).length;

  if (mapProgress) {
    mapProgress.textContent =
      "Areas explored: " + exploredCount + " / " + locations.length;
  }

  let hasNewLocation = false;

  locations.forEach(function (location, index) {
    const isUnlocked =
      gameState.unlockedScenes.includes(location.id);
    const isCurrent = location.id === gameState.currentScene;
    const isComplete = isSceneComplete(location.id);
    const isVisited =
      gameState.visitedScenes.includes(location.id);

    let statusText;
    let statusClass;
    let hintText = "";

    if (!isUnlocked) {
      statusText = "Locked";
      statusClass = "status-locked";
      hintText = "Finish exploring the previous area to unlock.";
    } else if (isCurrent) {
      statusText = isComplete ? "You are here · Explored" : "You are here";
      statusClass = "status-current";
    } else if (isComplete) {
      statusText = "Explored";
      statusClass = "status-done";
    } else if (!isVisited) {
      statusText = "New";
      statusClass = "status-new";
      hintText = "Newly unlocked. Head here next.";
      hasNewLocation = true;
    } else {
      statusText = "Unfinished";
      statusClass = "status-progress";
      hintText = "There is still something to find here.";
    }

    const locationButton = document.createElement("button");
    locationButton.type = "button";
    locationButton.classList.add("location-button");

    if (isCurrent) {
      locationButton.classList.add("is-current");
    }

    if (statusClass === "status-new") {
      locationButton.classList.add("is-new");
    }

    const number = document.createElement("span");
    number.classList.add("location-number");
    number.textContent = index + 1;

    const info = document.createElement("span");
    info.classList.add("location-info");

    const nameElement = document.createElement("span");
    nameElement.classList.add("location-name");
    nameElement.textContent = isUnlocked ? location.name : "???";
    info.appendChild(nameElement);

    if (hintText) {
      const hintElement = document.createElement("span");
      hintElement.classList.add("location-hint");
      hintElement.textContent = hintText;
      info.appendChild(hintElement);
    }

    const status = document.createElement("span");
    status.classList.add("location-status", statusClass);
    status.textContent = statusText;

    locationButton.appendChild(number);
    locationButton.appendChild(info);
    locationButton.appendChild(status);

    if (!isUnlocked) {
      locationButton.disabled = true;
    }

    locationButton.addEventListener("click", function () {
      handleLocationClick(location.id);
    });

    locationList.appendChild(locationButton);
  });

  // Red dot on the Map button while there is a new place to visit
  mapButton.classList.toggle("has-new", hasNewLocation);
}


function handleLocationClick(locationId) {
  if (
    !gameState.unlockedScenes.includes(locationId)
  ) {
    return;
  }

  closePanel(mapPanel);
  goToScene(locationId);
}


function goToScene(sceneId) {
  if (!gameState.unlockedScenes.includes(sceneId)) {
    return;
  }

  if (sceneId === "hall") {
    renderHall();
  } else if (sceneId === "wedding") {
    renderWeddingHall();
  } else if (sceneId === "bedroom") {
    renderBedroom();
  } else if (sceneId === "workshop") {
    renderWorkshop();
  } else if (sceneId === "corridor") {
    renderCorridor();
  }
}
function createWorkshopLedger() {
  const ledgerData = workshopItems.ledger;

  const ledger = document.createElement("img");

  ledger.src = ledgerData.image;
  ledger.alt = ledgerData.name;
  ledger.title = ledgerData.name;

  ledger.classList.add(
    "scene-prop",
    "workshop-prop"
  );

  ledger.style.left = ledgerData.left;
  ledger.style.top = ledgerData.top;
  ledger.style.width = ledgerData.width;

  ledger.addEventListener("click", function () {
    playSfx("audio/PageTurn.mp3");
    inspectWorkshopLedger();
  });

  propLayer.appendChild(ledger);
}
function createWorkshopCabinetHotspot() {
  const cabinet = document.createElement("button");

  cabinet.type = "button";
  cabinet.title = "Locked old cabinet";
  cabinet.setAttribute(
    "aria-label",
    "Examine the locked old cabinet"
  );

cabinet.classList.add(
  "scene-prop",
  "workshop-cabinet-hotspot"
);
  cabinet.style.left = "72%";
  cabinet.style.top = "35%";
  cabinet.style.width = "18%";
  cabinet.style.height = "42%";

cabinet.addEventListener("click", function () {
  inspectWorkshopCabinet();
});
  propLayer.appendChild(cabinet);
}
function inspectWorkshopCabinet() {
  if (gameState.workshopProgress.cabinetOpened) {
    openModal({
      title: "The Opened Old Cabinet",
      description:
        "The cabinet door is open. Half a marriage contract and a fragment of the wedding photo lie pressed inside.",
      actions: [
        {
          label: "Close",
          action: closeItemModal
        }
      ]
    });

    return;
  }

  if (selectedItemId !== "key") {
    openModal({
      title: "Locked Old Cabinet",
      description:
        "The cabinet door is shut with a bronze lock. First select the Old Bronze Key from the inventory bar at the bottom.",
      actions: [
        {
          label: "Close",
          action: closeItemModal
        }
      ]
    });

    return;
  }

  openModal({
    title: "Locked Old Cabinet",
    description:
      "The old bronze key slides neatly into the keyhole. As you turn it, a dull thud sounds from inside the cabinet.",
    actions: [
      {
        label: "Open the Cabinet",
        action: function () {
          playSfx("audio/DoorOpen.mp3");
          openWorkshopCabinet();
        }
      },
      {
        label: "Close",
        action: closeItemModal
      }
    ]
  });
}

function openWorkshopCabinet() {
  gameState.workshopProgress.cabinetOpened = true;

  gameState.inventory =
    gameState.inventory.filter(function (itemId) {
      return itemId !== "key";
    });

  if (!gameState.usedItems.includes("key")) {
    gameState.usedItems.push("key");
  }

  selectedItemId = null;

  saveGame();
  closeItemModal();
  renderInventory();
  renderWorkshop();
  updateClueCounter();

  messageText.textContent =
    "The old cabinet is open. Half a marriage contract and a photo fragment lie pressed inside.";
}
function createWorkshopCabinetRewards() {
  if (
    !gameState.workshopProgress.contractBottomCollected
  ) {
    createWorkshopReward(
      workshopItems.contractBottom,
      "68%",
      "49%",
      "10%"
    );
  }

  if (
    !gameState.workshopProgress.photoFragmentCollected
  ) {
    createWorkshopReward(
      workshopItems.photoFragment,
      "79%",
      "52%",
      "7%"
    );
  }
}

function createWorkshopReward(
  itemData,
  left,
  top,
  width
) {
  const reward = document.createElement("img");

  reward.src = itemData.image;
  reward.alt = itemData.name;
  reward.title = itemData.name;

  reward.classList.add(
    "scene-prop",
    "workshop-reward"
  );

  reward.style.left = left;
  reward.style.top = top;
  reward.style.width = width;

  reward.addEventListener("click", function () {
    inspectWorkshopReward(itemData);
  });

  propLayer.appendChild(reward);
}

function inspectWorkshopReward(itemData) {
  openModal({
    title: itemData.name,
    image: itemData.image,
    description: itemData.description,
    actions: [
      {
        label: "Take the Clue",
        action: function () {
          collectWorkshopReward(itemData);
        }
      },
      {
        label: "Close",
        action: closeItemModal
      }
    ]
  });
}

function collectWorkshopReward(itemData) {
  if (itemData.id === "marriage-bottom") {
    gameState.workshopProgress
      .contractBottomCollected = true;

    if (
      !gameState.inventory.includes(
        "marriage-bottom"
      )
    ) {
      gameState.inventory.push(
        "marriage-bottom"
      );
    }
  }

  if (itemData.id === "photo-fragment") {
    gameState.workshopProgress
      .photoFragmentCollected = true;

    const alreadyCollected =
      gameState.clues.some(function (clue) {
        return clue.id === "photo-fragment";
      });

    if (!alreadyCollected) {
      gameState.clues.push({
        id: itemData.id,
        name: itemData.name,
        image: itemData.image,
        description: itemData.description
      });
    }
  }

  saveGame();
  closeItemModal();
  renderInventory();
  renderCluePanel();
  renderWorkshop();
  updateClueCounter();

  messageText.textContent =
    "Item found: " + itemData.name;
    checkMarriageContractReady();
    checkPhotoRepairReady();
}
function inspectWorkshopLedger() {
  const ledgerData = workshopItems.ledger;

  if (gameState.workshopProgress.ledgerRevealed) {
    openModal({
      title: "The Revealed Old Ledger",
      image: ledgerData.image,
      description:
        "Candlelight has passed over the page, and the hidden records have appeared.",
      actions: [
        { label: "Close", action: closeItemModal }
      ]
    });
    return;
  }

  if (selectedItemId !== "candle") {
    openModal({
      title: ledgerData.name,
      image: ledgerData.image,
      description:
        ledgerData.description +
        "\n\nFirst select the candle from the inventory bar.",
      actions: [
        { label: "Close", action: closeItemModal }
      ]
    });
    return;
  }

  openModal({
    title: ledgerData.name,
    image: ledgerData.image,
    description:
      "You hold the candle close to the ledger, and dark red writing slowly surfaces.",
    actions: [
      {
        label: "Light the Ledger",
        action: revealWorkshopLedger
      },
      {
        label: "Close",
        action: closeItemModal
      }
    ]
  });
}
function revealWorkshopLedger() {
  const ledgerData = workshopItems.ledger;

  gameState.workshopProgress.ledgerRevealed = true;

  gameState.inventory =
    gameState.inventory.filter(function (itemId) {
      return itemId !== "candle";
    });

  if (!gameState.usedItems.includes("candle")) {
    gameState.usedItems.push("candle");
  }

  const alreadyInClues =
    gameState.clues.some(function (clue) {
      return clue.id === "ledger";
    });

  if (!alreadyInClues) {
    gameState.clues.push({
      id: "ledger",
      name: "The Revealed Old Ledger",
      image: ledgerData.image,
      description:
        "The ledger's hidden records show that the name of the Lin family's eldest daughter was deliberately struck out, and that she was written into the marriage contract as a nameless substitute."
    });
  }

  selectedItemId = null;

  saveGame();
  closeItemModal();
  renderInventory();
  renderCluePanel();
  renderWorkshop();
  updateClueCounter();

  messageText.textContent =
    "The candlelight revealed the hidden records, and the old ledger has been added to your clues.";
}
/* =========================
   Open and Close Panels
========================= */

mapButton.addEventListener("click", function () {
  renderMap();

  mapPanel.classList.remove("hidden");
  mapPanel.setAttribute("aria-hidden", "false");
});


clueButton.addEventListener("click", function () {
  renderCluePanel();

  cluePanel.classList.remove("hidden");
  cluePanel.setAttribute("aria-hidden", "false");
});


document
  .querySelectorAll(".close-button")
  .forEach(function (button) {
    button.addEventListener("click", function () {
      const panelId = button.dataset.close;
      const panel = document.querySelector(
        "#" + panelId
      );

      closePanel(panel);
    });
  });


function closePanel(panel) {
  panel.classList.add("hidden");
  panel.setAttribute("aria-hidden", "true");
}


/* Click the black backdrop to close a panel */

document
  .querySelectorAll(".overlay-panel")
  .forEach(function (panel) {
    panel.addEventListener("click", function (event) {
      if (event.target === panel) {
        closePanel(panel);
      }
    });
  });


/* =========================
   Sound & Music Toggle
========================= */

soundButton.addEventListener("click", function () {
  gameState.soundEnabled =
    !gameState.soundEnabled;

  bgmAudio.muted = !gameState.soundEnabled;

  if (gameState.soundEnabled) {
    bgmAudio.play().catch(function () {});
  } else {
    bgmAudio.pause();
    stopRadioEffects();
  }

  updateSoundButton();
  renderInventory();
  saveGame();
});


function updateSoundButton() {
  if (gameState.soundEnabled) {
    soundButton.textContent = "Sound: On";
  } else {
    soundButton.textContent = "Sound: Off";
  }
}


/* =========================
   Reset Game
========================= */

resetButton.addEventListener("click", function () {
  const shouldReset = window.confirm(
    "Are you sure you want to clear all investigation progress and start over?"
  );

  if (!shouldReset) {
    return;
  }

  localStorage.removeItem("namelessWeddingSave");
  window.location.reload();
});


/* =========================
   Close Panels with the Keyboard
========================= */

document.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") {
    return;
  }

  closeItemModal();
  closePanel(mapPanel);
  closePanel(cluePanel);
});
