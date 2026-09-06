export const georgiaPalette = "Mtkvari blue, Tbilisi brick red, sulfur-bath teal, Caucasus snow white, vine green, Kakheti amber, Black Sea cobalt, Mars copper, basalt black and solar gold";
export const georgiaProhibitions = "Use respectful secular Georgian geography through the Mtkvari river corridor, Tbilisi balcony slopes and sulfur-bath domes, Mount Kazbek and the Terek valley, Sighnaghi walls and the Alazani Valley, and Batumi Boulevard with the Black Sea skyline. Do not copy sacred imagery, church decoration, religious vestments, archaeological artifacts, folk costumes, protected textile patterns, a literal flag, coat of arms, official seal, political messaging, military identity, police identity, emergency-service identity, space-agency uniform, logo, badge, readable text, combat, threat, alcohol consumption, or weaponized expedition equipment.";

const paperTarget = (setting) => `one plain non-humanoid geometric paper route symbol fixed to a complete thick earth-and-sand backstop on ${setting}, separated from every person, mascot, landmark, public path, vehicle, Mars-expedition structure and camera`;
const waterTarget = (setting) => `one clearly empty floating route marker in ${setting}, with no person, animal, vessel, building, occupied object, public path or camera along or beyond the complete visible line`;

const specs = [
  [1548, "country-led hybrid", "a broad secured Mtkvari river terrace in Tbilisi with the complete illuminated Peace Bridge sweep, Old Town balcony slopes, Narikala ridge silhouette and the rounded Abanotubani sulfur-bath domes, fused equally with a fictional Mars-surface field atelier of copper aerobrake ribs, basalt sample rails and low regolith berms", "Peace Bridge suspension arcs, carved balcony planes, sulfur-dome scales, river ribbons, aerobrake ribs, basalt sample rails and regolith geometry", "Tbilisi reads through the full Mtkvari bend, Peace Bridge structure, balcony-clad Old Town slope, Narikala ridge and sulfur-bath domes. All heritage references remain secular and architectural.", "Radiance, Ellie and Alia carry hard large bridge, balcony, river and sulfur-dome motifs; Radiance and ECE also use unmistakable aerobrake, sample-rail and regolith construction.", {
    Radiance: "Mtkvari-blue suspension-drape jacket over an opaque Tbilisi-brick origami skort with large bridge-steel arcs, Mars-copper aerobrake cuffs and stepped suspension boots",
    Ellie: "Tbilisi-brick crenellation corsage over opaque Black-Sea-cobalt wrapped wide trousers with raised balcony planes, sulfur-teal dome appliques and pressure-ring heels",
    Alia: "sulfur-teal dome-shoulder sculpture above a snow-white scalloped overskirt and opaque basalt tailored shorts, with braided river cords, balcony-lattice pumps and dimensional dome corsages",
    "AI ECE": "Mars-copper regolith-blade bodice with an opaque asymmetric basalt sail skirt, solar-gold sample-vault discs and articulated tread wedges"
  }, paperTarget("a closed dry riverside cinema-training lane behind transparent safety panels"), waterTarget("a cordoned visibly empty Mtkvari route lane far from bridges, boats and both riverbanks"), "Only rolled mascots appear on a secured padded dry lounge far from the river edge, public paths, expedition equipment and both prop lanes."],
  [1549, "country-led hybrid", "a broad secured Stepantsminda overlook with the complete snow-capped Mount Kazbek mass, deep Terek valley, layered Darial cliffs and the town's clustered roofs, fused equally with a fictional Mars-surface ridge laboratory of thermal vanes, pressure rings, rover-joint rails and low regolith shields", "Kazbek snow facets, Terek river ribbons, gorge strata, roof planes, thermal vanes, pressure rings and rover-joint rails", "Stepantsminda reads through Mount Kazbek, the Terek valley, Darial cliff layers and town roofs. No church, sacred image or religious decoration is used as a garment motif.", "Radiance, Ellie and Alia carry hard large snow-ridge, gorge, river and roof-plane motifs; Radiance and ECE also carry thermal-vane, pressure-ring and rover-joint construction.", {
    Radiance: "Caucasus-silver ridge bolero over opaque Mtkvari-blue sail trousers with ice-facet beadwork, Mars-copper heat-radiator fins and split-ridge boots",
    Ellie: "basalt gorge cocoon coatdress with carmine Terek insets, a snow-white stepped hem, carved cliff ribs and gyroscope heels",
    Alia: "glacier-blue avalanche-vane wrap jacket over opaque carmine tailored shorts with braided ridge cords, solar-gold relief plates and crater heels",
    "AI ECE": "Mars-copper thermal-foil torus top above an opaque graphite razor-pleat skirt with pressure-ring joints and magnetic tread boots"
  }, paperTarget("a closed dry earth-and-sand cinema-training lane on the expedition terrace"), waterTarget("a transparent shallow blue cinema-safety basin on the secured dry deck, separated from the Terek valley, cliffs and public routes"), "Only rolled mascots appear on a secured padded dry ridge lounge far from cliffs, snow, public routes, expedition equipment and both prop lanes."],
  [1550, "theme-led original", "a broad secured Sighnaghi overlook with complete ochre defensive-wall curves and towers, terracotta roof terraces, the full green Alazani Valley vineyard grid and the Greater Caucasus horizon, fused equally with a fictional Mars-surface agriculture laboratory of pressure seals, sample pods, solar petals and basalt analysis frames", "location-only wall curves, tower rhythms, vineyard terraces, valley depth, pressure seals, sample pods, solar petals and analysis frames", "Kakheti reads through Sighnaghi's complete wall and tower line, terracotta roofs, Alazani Valley vineyard geometry and the Greater Caucasus. Grapevine forms are botanical only; no alcohol is shown or consumed.", "Pressure-seal crescent, crater-rib jumpsuit, solar-petal mantle and basalt sample-vault trapeze create four unrelated Mars-expedition silhouettes while Sighnaghi and the Alazani Valley remain equally large and foregrounded.", {
    Radiance: "Mars-copper pressure-seal crescent capelet over opaque vine-green spiral trousers with Kakheti-amber sample-pod bead clusters and crescent-sole boots",
    Ellie: "basalt crater-rib halter jumpsuit with a fully opaque snow-white torso, asymmetric amber hip fins, graphite joint channels and low magnetic platforms",
    Alia: "solar-gold petal mantle over an opaque Mtkvari-blue folded tulip skirt with braided copper analysis cords and faceted prism pumps",
    "AI ECE": "basalt sample-vault trapeze tunic over opaque Mars-copper tapered trousers with vine-green sensor tiles, rigid side frames and segmented rover shoes"
  }, paperTarget("a closed dry earth-and-sand cinema-training lane on the laboratory terrace"), waterTarget("a transparent shallow blue cinema-safety basin on the secured dry deck, separated from walls, vineyards, public paths and valley drops"), "Only rolled mascots appear on a secured padded dry garden lounge far from walls, vineyard rows, public paths, expedition equipment and both prop lanes."],
  [1551, "theme-led original", "a broad secured Batumi Boulevard platform with the complete Black Sea horizon, Alphabet Tower silhouette, Ferris wheel, palms and modern Adjara skyline, fused equally with a fictional Mars-surface coastal observation court of aerobrake halos, solar-foil baffles, dust-shield planes and rover-joint pylons", "location-only Black Sea horizon, Alphabet Tower lattice, Ferris-wheel circle, palm rhythm, aerobrake halos, solar baffles and rover-joint pylons", "Batumi reads through its complete Black Sea edge, Boulevard palms, Alphabet Tower, Ferris wheel and modern skyline. No copied sculpture, logo, sign or readable lettering is used.", "Aerobrake halo sheath, solar-foil fan jumpsuit, dust-shield origami tabard and rover-joint peplum create four structurally different Mars-expedition outfits while Batumi's Black Sea skyline remains equally large and recognizable.", {
    Radiance: "solar-gold aerobrake-halo yoke over an opaque Black-Sea-cobalt high-low sheath with Mars-copper lens pucks and halo-arch heels",
    Ellie: "snow-white solar-foil fan-sleeve jumpsuit with opaque sulfur-teal side panels, basalt heat-baffle ribs and articulated wedge boots",
    Alia: "Mars-copper dust-shield origami tabard over an opaque cobalt pleated skort with braided palm-green conduits and angular shield pumps",
    "AI ECE": "basalt rover-joint segmented peplum jacket over opaque solar-gold stirrup trousers with cobalt pressure discs and piston-platform shoes"
  }, paperTarget("a closed dry earth-and-sand cinema-training lane behind complete transparent safety panels"), waterTarget("a cordoned clearly empty Black Sea marker lane far from swimmers, vessels, piers, shoreline users and the Boulevard"), "Only rolled mascots appear on a secured padded dry boulevard lounge far from the sea edge, public paths, observation structures, expedition equipment and both prop lanes."]
];

export const georgiaSceneSpecs = specs.map(([scene, mode, landmark, motifs, culture, motifPolicy, outfits, paper, water, mascotPlan]) => ({
  scene,
  mode,
  theme: "Mars-surface expedition couture",
  landmark,
  motifs,
  culture,
  motifPolicy,
  paperTarget: paper,
  waterTarget: water,
  outfits,
  mascotPlan,
  composition: "Handler-aware hard-love choreography is resolved after all deterministic rolls.",
  hands: ["Handler-aware hand inventory is resolved after all deterministic rolls."]
}));
