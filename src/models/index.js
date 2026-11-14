
import Farmer from "./farmer.js";
import Farm from "./farm.js";
import CropCycle from "./cropCycle.js";
import FarmerObservation from "./farmerObservation.js";
import Recommendation from "./recommendation.js";
import Conversation from "./conversation.js";
import ConversationMessage from "./conversationMessage.js";

import User from "./user.js";
import AuthOtp from "./authOtp.js";
import AuthSession from "./authSession.js";

// Authentication relationships
User.belongsTo(Farmer, {
  foreignKey: "farmerId",
  as: "farmer",
});

Farmer.hasOne(User, {
  foreignKey: "farmerId",
  as: "user",
});

User.hasMany(AuthSession, {
  foreignKey: "userId",
  as: "sessions",
});

AuthSession.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

export {
  Farmer,
  Farm,
  CropCycle,
  FarmerObservation,
  Recommendation,
  Conversation,
  User,
  AuthOtp,
  AuthSession,
  ConversationMessage,
};
