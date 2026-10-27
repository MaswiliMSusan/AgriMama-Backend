const farmerResponses = {
  INSPECT_CROP_DAMAGE: {
    en: {
      message:
        "You've reported that insects are eating your maize leaves. Please inspect several affected plants and observe what the leaf damage looks like before applying any pesticide. Tell me what you see on the affected leaves so I can help with the next step.",
      validated: true,
    },

    dholuo: {
      // Replace this with the Dholuo wording validated by your
      // fluent Homa Bay/Dholuo speaker.
      message: null,
      validated: false,
    },
  },

  CHECK_SOIL_MOISTURE: {
    en: {
      message:
        "Please check the soil moisture in several areas of your field and observe whether the maize is showing signs of water stress before deciding on the next action.",
      validated: true,
    },

    dholuo: {
      message: null,
      validated: false,
    },
  },

  CHECK_WEATHER_CONDITION: {
    en: {
      message:
        "Please observe the current weather and field conditions and tell me what you are seeing so I can help determine the next step.",
      validated: true,
    },

    dholuo: {
      message: null,
      validated: false,
    },
  },

  PROVIDE_MORE_INFORMATION: {
    en: {
      message:
        "I need a little more information before I can suggest the next step. Please describe what you are seeing in your field.",
      validated: true,
    },

    dholuo: {
      message: null,
      validated: false,
    },
  },

  SEEK_HUMAN_SUPPORT: {
    en: {
      message:
        "I don't have enough information to provide a safe recommendation yet. Please seek support from an agricultural extension officer or another trusted agricultural expert.",
      validated: true,
    },

    dholuo: {
      message: null,
      validated: false,
    },
  },
};

export function getFarmerResponse(actionCode, language = "en") {
  if (!actionCode) {
    throw new Error("actionCode is required.");
  }

  const responseSet = farmerResponses[actionCode];

  if (!responseSet) {
    throw new Error(
      `No farmer response template found for action: ${actionCode}`
    );
  }

  const normalizedLanguage = language
    .toLowerCase()
    .trim();

  const response = responseSet[normalizedLanguage];

  if (!response) {
    throw new Error(
      `No response template for action "${actionCode}" in language "${normalizedLanguage}".`
    );
  }

  if (!response.validated || !response.message) {
    return {
      status: "translation_unavailable",
      actionCode,
      language: normalizedLanguage,
      message: null,
    };
  }

  return {
    status: "ready",
    actionCode,
    language: normalizedLanguage,
    message: response.message,
  };
}