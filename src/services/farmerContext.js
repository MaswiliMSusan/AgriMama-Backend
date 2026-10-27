import Farmer from "../models/farmer.js";
import Farm from "../models/farm.js";
import CropCycle from "../models/cropCycle.js";

export async function resolveFarmerContext(phone) {
  if (!phone) {
    throw new Error("Phone number is required.");
  }

  // --------------------------------------------------
  // 1. Find farmer
  // --------------------------------------------------
  const farmer = await Farmer.findOne({
    where: {
      phone,
    },
  });

  if (!farmer) {
    return {
      status: "not_found",
      farmer: null,
      farm: null,
      cropCycle: null,
    };
  }

  // --------------------------------------------------
  // 2. Find farmer's farms
  // --------------------------------------------------
  const farms = await Farm.findAll({
    where: {
      farmerId: farmer.id,
    },
    order: [["createdAt", "ASC"]],
  });

  if (farms.length === 0) {
    return {
      status: "no_farm",
      farmer,
      farm: null,
      cropCycle: null,
    };
  }

  // --------------------------------------------------
  // 3. Find active crop cycles for the farmer's farms
  // --------------------------------------------------
  const farmIds = farms.map((farm) => farm.id);

  const cropCycles = await CropCycle.findAll({
    where: {
      farmId: farmIds,
      status: "active",
    },
    order: [["plantingDate", "DESC"]],
  });

  // --------------------------------------------------
  // 4. One farm + one active crop
  //    → straightforward context
  // --------------------------------------------------
  if (farms.length === 1 && cropCycles.length === 1) {
    return {
      status: "resolved",
      farmer,
      farm: farms[0],
      cropCycle: cropCycles[0],
    };
  }

  // --------------------------------------------------
  // 5. Multiple farms/crops
  //    → we need clarification
  // --------------------------------------------------
  if (farms.length > 1 || cropCycles.length > 1) {
    return {
      status: "ambiguous",
      farmer,
      farms,
      cropCycles,
      farm: null,
      cropCycle: null,
    };
  }

  // --------------------------------------------------
  // 6. Farmer exists but has no active crop
  // --------------------------------------------------
  return {
    status: "no_active_crop",
    farmer,
    farm: farms[0] || null,
    cropCycle: null,
  };
}