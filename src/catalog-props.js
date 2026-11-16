// One hand-held object per performer. Transfer windows meet at the same instant.
export const previewProps={
  S01_meal_together:[['snack',2.45],['snack',1.9,4.1]],
  S02_share_last_food:[['snack',0,4.35],['snack',4.35]],
  S05_steal_caught:[['parcel',2.35]],
  S06_tend_sick:[['medicine',2.4]],
  S07_winter_night_share:[['cloth',0,2.95],['cloth',2.95]],
  S08_argue_ration:[['snack',0]],
  S09_bury_grief:[['flower',0,3.4]],
  S13_work_together:[['shovel',1.85,3.95]],
  S14_meal_normal:[['snack',.73,4.12]],
  S15_drink_together:[['cup',.7],['cup',.78]],
  S18_fight_over_food:[['snack',.72]],
  S19_steal_food:[['snack',2.36]],
  S20_water_fight:[null,['cup',2.42]],
  S21_steal_water:[['cup',2.38]],
  S25_teach_skill:[['spoon',0],['spoon',1.96]],
  S30_cook_together:[['spoon',0],['spoon',.72]],
  S31_share_recipe:[['spoon',1.84],['spoon',4.04]],
  S32_food_hoarding:[['snack',.74]],
  S33_last_meal_ritual:[['snack',0,4.31],['snack',4.31]],
  S34_feed_sick:[['spoon',0,4.14]],
  S35_well_queue:[null,['bucket',4.41]],
  S36_water_ration_fight:[['cup',0]],
  S37_rain_collect:[['bucket',2.45]],
  S38_carry_water:[['bucket',1.71]],
  S39_dirty_water:[['cup',0,4.1]],
  S41_burn_others_wood:[['timber',.75,5.1]],
  S43_build_wall:[['timber',0,3.62],['timber',.71,3.62]],
  S44_fight_over_supplies:[null,['parcel',.75]],
  S47_steal_stock:[['parcel',2.05]], S48_steal_medicine:[['medicine',1.85]],
  S49_torn_clothes:[['cloth',0]], S50_share_clothes:[['cloth',0,2.92],['cloth',2.92]],
  S51_wash_clothes:[['cloth',0,5.30]], S52_cloth_gift:[['cloth',0,2.88],['cloth',2.88]],
  S53_build_shelter:[['timber',0,2.96],['timber',.78,3.71]],
  S54_dig_pit:[['shovel',0]], S55_clear_land:[['timber',2.48]],
  S60_trade_item:[['parcel',0,2.95],['parcel',2.95]],
  S61_show_treasure:[['parcel',.75]], S63_decorate:[['cloth',0,3.46]],
  S66_visit_grave:[['flower',0,3.26]], S72_child_birth:[['baby',0]]
};

export function propAt(scene,role,kind,seconds,start,end){
  const cue=previewProps[scene]?.[role];
  const selected=kind??cue?.[0];
  if(!selected)return null;
  const prescribed=selected===cue?.[0];
  return seconds>=(start??(prescribed?cue[1]:0)) && seconds<(end??(prescribed?cue[2]:undefined)??Infinity)?selected:null;
}
