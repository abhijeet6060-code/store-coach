// Sample catalog for the demo. Prices, names and stock are illustrative, not real store data.
// weight: 1 = light/breathable, 2 = medium, 3 = heavy/embellished
export const OUTFITS = [
  { id: "SH01", name: "Ivory Zari Sherwani with Churidar", type: "Sherwani", price: 38999, colours: ["ivory", "gold"], fabric: "Silk blend", weight: 3, occasions: ["wedding", "reception"], roles: ["groom"], sizes: { 38: 2, 40: 3, 42: 1, 44: 0 } },
  { id: "SH02", name: "Maroon Velvet Sherwani Set", type: "Sherwani", price: 44999, colours: ["maroon", "gold"], fabric: "Velvet", weight: 3, occasions: ["wedding", "reception"], roles: ["groom"], sizes: { 38: 1, 40: 0, 42: 2, 44: 1 } },
  { id: "SH03", name: "Peach Thread-work Sherwani", type: "Sherwani", price: 29999, colours: ["peach", "pastel"], fabric: "Art silk", weight: 2, occasions: ["wedding", "reception", "sangeet"], roles: ["groom", "brother"], sizes: { 38: 2, 40: 2, 42: 2, 44: 1 } },
  { id: "SH04", name: "Navy Embroidered Sherwani", type: "Sherwani", price: 24999, colours: ["navy", "silver"], fabric: "Jacquard", weight: 2, occasions: ["wedding", "reception"], roles: ["groom", "brother", "friend"], sizes: { 38: 0, 40: 2, 42: 3, 44: 2 } },
  { id: "IW01", name: "Black Indo-Western with Drape", type: "Indo-Western", price: 21999, colours: ["black", "silver"], fabric: "Poly silk", weight: 2, occasions: ["reception", "sangeet", "cocktail"], roles: ["groom", "brother", "friend"], sizes: { 38: 3, 40: 2, 42: 1, 44: 1 } },
  { id: "IW02", name: "Sage Green Asymmetric Indo-Western", type: "Indo-Western", price: 18999, colours: ["green", "pastel"], fabric: "Cotton silk", weight: 2, occasions: ["sangeet", "mehendi", "cocktail"], roles: ["groom", "brother", "friend"], sizes: { 38: 2, 40: 3, 42: 2, 44: 0 } },
  { id: "JB01", name: "Wine Jodhpuri Bandhgala Suit", type: "Bandhgala", price: 16999, colours: ["wine", "maroon"], fabric: "Terry rayon", weight: 2, occasions: ["reception", "cocktail", "festive"], roles: ["father", "brother", "friend", "guest"], sizes: { 38: 1, 40: 3, 42: 3, 44: 2 } },
  { id: "JB02", name: "Beige Textured Bandhgala", type: "Bandhgala", price: 14999, colours: ["beige", "gold"], fabric: "Linen blend", weight: 1, occasions: ["reception", "festive", "wedding"], roles: ["father", "guest", "friend"], sizes: { 38: 2, 40: 2, 42: 2, 44: 3 } },
  { id: "KJ01", name: "Yellow Kurta with Printed Nehru Jacket", type: "Kurta + Jacket", price: 7999, colours: ["yellow", "pastel"], fabric: "Cotton", weight: 1, occasions: ["haldi", "mehendi", "festive"], roles: ["groom", "brother", "friend", "guest"], sizes: { 38: 4, 40: 5, 42: 3, 44: 2 } },
  { id: "KJ02", name: "Mint Kurta Set with Mirror-work Jacket", type: "Kurta + Jacket", price: 9999, colours: ["green", "pastel"], fabric: "Cotton silk", weight: 1, occasions: ["mehendi", "sangeet", "haldi"], roles: ["groom", "brother", "friend", "guest"], sizes: { 38: 2, 40: 3, 42: 2, 44: 2 } },
  { id: "KJ03", name: "Royal Blue Silk Kurta with Brocade Jacket", type: "Kurta + Jacket", price: 11999, colours: ["blue", "gold"], fabric: "Silk blend", weight: 2, occasions: ["sangeet", "festive", "wedding", "puja"], roles: ["brother", "father", "friend", "guest"], sizes: { 38: 1, 40: 2, 42: 3, 44: 2 } },
  { id: "KS01", name: "White Chikankari Kurta Pajama", type: "Kurta Set", price: 4999, colours: ["white", "pastel"], fabric: "Cotton", weight: 1, occasions: ["haldi", "puja", "festive"], roles: ["groom", "brother", "father", "friend", "guest"], sizes: { 38: 6, 40: 5, 42: 4, 44: 3 } },
  { id: "KS02", name: "Mustard Silk Kurta Set", type: "Kurta Set", price: 5999, colours: ["mustard", "yellow"], fabric: "Art silk", weight: 1, occasions: ["haldi", "festive", "puja", "mehendi"], roles: ["brother", "father", "friend", "guest"], sizes: { 38: 3, 40: 4, 42: 3, 44: 2 } },
  { id: "KS03", name: "Maroon Festive Kurta with Dhoti Pants", type: "Kurta Set", price: 6999, colours: ["maroon", "gold"], fabric: "Silk blend", weight: 2, occasions: ["festive", "puja", "wedding"], roles: ["brother", "father", "friend", "guest"], sizes: { 38: 2, 40: 0, 42: 2, 44: 1 } },
];

export const ADDONS = [
  { id: "SF01", name: "Gold Brocade Safa", category: "Safa", price: 2499, colours: ["gold", "ivory", "maroon", "peach"], roles: ["groom"], occasions: ["wedding"] },
  { id: "SF02", name: "Pink Leheriya Safa", category: "Safa", price: 1499, colours: ["pastel", "peach", "ivory", "beige"], roles: ["brother", "father", "friend", "guest"], occasions: ["wedding"] },
  { id: "MJ01", name: "Gold Embroidered Mojari", category: "Footwear", price: 2999, colours: ["gold", "ivory", "maroon", "beige", "peach"], roles: ["any"], occasions: ["wedding", "reception", "sangeet", "festive"] },
  { id: "MJ02", name: "Tan Leather Kolhapuri", category: "Footwear", price: 1799, colours: ["any"], roles: ["any"], occasions: ["haldi", "mehendi", "puja", "festive"] },
  { id: "MJ03", name: "Black Velvet Loafers", category: "Footwear", price: 3499, colours: ["black", "navy", "wine", "maroon", "silver"], roles: ["any"], occasions: ["reception", "cocktail", "sangeet"] },
  { id: "DP01", name: "Silk Dupatta / Stole", category: "Stole", price: 1999, colours: ["maroon", "gold", "ivory", "peach", "pastel"], roles: ["groom", "brother"], occasions: ["wedding", "sangeet", "reception"] },
  { id: "ML01", name: "Pearl Layered Mala", category: "Accessory", price: 1299, colours: ["ivory", "gold", "peach", "pastel", "maroon"], roles: ["groom", "brother"], occasions: ["wedding", "reception"] },
  { id: "BR01", name: "Kundan Brooch", category: "Accessory", price: 899, colours: ["any"], roles: ["any"], occasions: ["wedding", "reception", "sangeet", "cocktail", "festive"] },
  { id: "PS01", name: "Silk Pocket Square", category: "Accessory", price: 499, colours: ["any"], roles: ["any"], occasions: ["reception", "cocktail", "festive"] },
  { id: "KT01", name: "Embroidered Kalgi", category: "Accessory", price: 1599, colours: ["gold", "ivory", "maroon"], roles: ["groom"], occasions: ["wedding"] },
];

export const OCCASIONS = ["wedding", "reception", "sangeet", "mehendi", "haldi", "cocktail", "festive", "puja"];
export const ROLES = ["groom", "brother", "father", "friend", "guest"];
export const COLOURS = ["any", "ivory", "gold", "maroon", "wine", "peach", "pastel", "navy", "blue", "black", "green", "yellow", "mustard", "white", "beige"];
export const SIZES = [38, 40, 42, 44];
