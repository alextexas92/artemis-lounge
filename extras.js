// Zero-proof drinks and the extra ingredients they use. Kept apart from
// data.js, which is generated from the spreadsheet.
(function () {
  const ING = window.AL_INGREDIENTS;
  ING['ginger-ale'] = { label: 'Ginger Ale', group: 'Mixers' };
  ING['orange-juice'] = { label: 'Orange Juice', group: 'Juices' };
  ING['beer'] = { label: 'Beer', group: 'Beer & Cider' };
  ING['cider'] = { label: 'Hard Cider', group: 'Beer & Cider' };
  ING['hard-seltzer'] = { label: 'Hard Seltzer', group: 'Beer & Cider' };
  ING['lemons'] = { label: 'Lemons', group: 'Fresh & Pantry' };
  ING['limes'] = { label: 'Limes', group: 'Fresh & Pantry' };
  ING['oranges'] = { label: 'Oranges', group: 'Fresh & Pantry' };
  ING['olives'] = { label: 'Cocktail Olives', group: 'Fresh & Pantry' };
  ING['cherries'] = { label: 'Cocktail Cherries', group: 'Fresh & Pantry' };

  const i = (amt, name, keys, optional) => ({ amt, name, keys, optional: !!optional });
  const zp = (id, name, glass, method, garnish, steps, ingredients) => ({
    id, name, base: 'Zero Proof', category: 'Mocktail', glass, method, garnish, difficulty: 'Beginner', steps, source: '', zeroProof: true, ingredients,
  });

  window.AL_RECIPES.push(
    zp('zp-nojito', 'Virgin Mojito', 'Highball Glass', 'Muddle', 'Mint sprig and lime wheel',
      'Gently muddle the mint with the syrup. Add lime juice and fill with ice. Top with club soda and stir once.',
      [i('8', 'Mint leaves', ['mint']), i('¾ oz', 'Simple Syrup', ['simple-syrup']), i('1 oz', 'Lime Juice', ['lime-juice']), i('Top', 'Club Soda', ['club-soda'])]),
    zp('zp-shirley-temple', 'Shirley Temple', 'Highball Glass', 'Build', 'Maraschino cherry',
      'Fill the glass with ice. Add ginger ale, then pour the grenadine in last so it sinks.',
      [i('6 oz', 'Ginger Ale', ['ginger-ale']), i('½ oz', 'Grenadine', ['grenadine'])]),
    zp('zp-roy-rogers', 'Roy Rogers', 'Highball Glass', 'Build', 'Maraschino cherry',
      'Fill the glass with ice. Add cola, then the grenadine.',
      [i('6 oz', 'Cola', ['cola']), i('½ oz', 'Grenadine', ['grenadine'])]),
    zp('zp-mule', 'Zero-Proof Mule', 'Copper Mug or Highball', 'Build', 'Lime wedge and mint sprig',
      'Fill the mug with ice. Add lime juice and top with ginger beer.',
      [i('½ oz', 'Lime Juice', ['lime-juice']), i('5 oz', 'Ginger Beer', ['ginger-beer'])]),
    zp('zp-paloma', 'Zero-Proof Paloma', 'Highball Glass', 'Build', 'Salt rim and lime wheel',
      'Salt half the rim. Fill with ice, add lime juice and top with grapefruit soda.',
      [i('½ oz', 'Lime Juice', ['lime-juice']), i('5 oz', 'Grapefruit Soda', ['grapefruit-soda']), i('Pinch', 'Salt for the rim', ['salt'], true)]),
    zp('zp-cran-spritz', 'Cranberry Lime Spritzer', 'Wine Glass', 'Build', 'Lime wheel',
      'Fill the glass with ice. Add cranberry juice and lime juice, then top with club soda.',
      [i('3 oz', 'Cranberry Juice', ['cranberry-juice']), i('¼ oz', 'Lime Juice', ['lime-juice']), i('Top', 'Club Soda', ['club-soda'])]),
    zp('zp-pineapple-ginger', 'Pineapple Ginger Fizz', 'Highball Glass', 'Build', 'Pineapple wedge',
      'Fill the glass with ice. Add pineapple and lime juice, then top with ginger beer.',
      [i('3 oz', 'Pineapple Juice', ['pineapple-juice']), i('½ oz', 'Lime Juice', ['lime-juice']), i('Top', 'Ginger Beer', ['ginger-beer'])]),
    zp('zp-strawberry-lemonade', 'Strawberry Lemonade', 'Highball Glass', 'Shake', 'Lemon wheel',
      'Shake lemon juice and strawberry syrup with ice. Strain into a glass of fresh ice and top with cold water or club soda.',
      [i('1 oz', 'Lemon Juice', ['lemon-juice']), i('1 oz', 'Strawberry Syrup', ['strawberry-syrup']), i('4 oz', 'Cold Water or Club Soda', ['water'])]),
    zp('zp-espresso-tonic', 'Espresso Tonic', 'Highball Glass', 'Build', 'Orange peel',
      'Fill the glass with ice and tonic. Slowly pour the espresso over the top so it floats.',
      [i('4 oz', 'Tonic Water', ['tonic']), i('1 oz', 'Fresh Espresso', ['espresso'])]),
    zp('zp-sunrise', 'Sunrise Cooler', 'Highball Glass', 'Build', 'Orange slice and cherry',
      'Fill the glass with ice and orange juice. Slowly pour the grenadine down the side so it settles at the bottom.',
      [i('5 oz', 'Orange Juice', ['orange-juice']), i('½ oz', 'Grenadine', ['grenadine'])]),
  );
})();

// Wine pairing guide, copied from the Food Pairing tab of the original spreadsheet.
window.AL_PAIRING = {
  sauces: [
    ['Tomato / Red Sauces', 'Chianti, Barbera, Tempranillo', 'High-acid reds match the acidity of tomatoes so nothing tastes flat.', 'Pasta marinara, pizza, shakshuka'],
    ['Creamy / Buttery Sauces', 'Chardonnay, Chenin Blanc, Champagne', 'High-acid wines cut through richness and keep things balanced.', 'Alfredo, carbonara, béchamel dishes'],
    ['Rich Meat Jus / Gravy', 'Cabernet Sauvignon, Syrah, Malbec', 'Structured reds can stand up to bold, deep flavors.', 'Roast beef, pot roast, lamb shanks'],
    ['Spicy Sauces', 'Riesling, Gewürztraminer, Gamay, Grenache', 'Off-dry whites cool things down. Juicy reds keep the peace.', 'Buffalo wings, Thai curry, hot sauce'],
    ['Green / Herb Sauces', 'Sauvignon Blanc, Grüner Veltliner', 'Crisp, zesty wines mirror the fresh herbs.', 'Pesto pasta, chimichurri steak, salsa verde'],
  ],
  foods: [
    ['Smash Burgers with Caramelized Onions', 'TerraNoble Gran Reserva Cabernet Sauvignon', 'Red'],
    ['Steak Frites', 'Kirkland Châteauneuf-du-Pape', 'Red'],
    ['Baked Brie', 'Kirkland Asolo Prosecco Superiore', 'Sparkling'],
    ['Fried Chicken Sandwiches', 'Juvé & Camps Reserva de la Familia Cava', 'Sparkling'],
    ['Fish Tacos', 'Laurenz V. Singing Grüner Veltliner', 'White'],
    ['Chicken Burrito Bowl', 'Albariño', 'White'],
    ['Barbacoa Burrito', 'Malbec', 'Red'],
    ['Carnitas Tacos', 'Chardonnay', 'White'],
    ['Steak Quesadilla', 'Tempranillo', 'Red'],
    ['Veggie Bowl', 'Cabernet Franc', 'Red'],
    ['Spicy Chorizo Burrito', 'Riesling', 'White'],
  ],
  apps: [
    ['Warm Party Olives', 'Castelvetrano olives, garlic, orange rind, rosemary, olive oil, salt and pepper. Warm and serve right away.', 'Prosecco, Grüner Veltliner, Rosé'],
    ['Baked Brie', 'Brie wheel, honey, nuts, crackers. Bake until gooey.', 'Prosecco, Champagne, Chardonnay'],
    ['Charcuterie Board', 'Cured meats, cheeses, olives, nuts, crackers, honey, fruit.', 'Any wine. Match it to the cheese.'],
  ],
};

// Course-by-course pairing. Each food style lists wine styles (grapes to look
// for in your rack), cocktails from the recipe list, a zero-proof pick and,
// where it fits, spirits to pour neat. The five sauce styles use the wines and
// reasons from the spreadsheet's pairing guide.
window.AL_COURSES = ['Welcome drink', 'Appetizer', 'Soup or salad', 'Main course', 'Cheese', 'Dessert', 'After dinner'];
window.AL_FOOD_STYLES = {
  aperitif: { label: 'Nibbles and welcome bites', match: 'olive|nuts|crostini|bruschetta|canap|chips|popcorn|welcome',
    grapes: ['Prosecco', 'Champagne', 'Cava'], types: ['Sparkling'], why: 'Bubbles and bitter aperitifs wake up the appetite without filling anyone up.',
    drinks: ['negroni-spagliato', 'french-75', 'kir-royale', 'champagne-cocktail', 'martini-dry', 'gin-tonic'], zp: 'zp-cran-spritz' },
  salty: { label: 'Salty or fried', match: 'fried|fries|tempura|calamari|wings|croquette|pretzel|salty|chicken sandwich',
    grapes: ['Champagne', 'Prosecco', 'Cava', 'Sauvignon Blanc'], types: ['Sparkling', 'White'], why: 'Bubbles and acid cut through salt and fat and reset your palate.',
    drinks: ['french-75', 'paloma', 'margarita', 'gin-tonic', 'champagne-cocktail'], zp: 'zp-paloma' },
  seafood: { label: 'Light fish or shellfish', match: 'fish|shrimp|scallop|oyster|crab|lobster|ceviche|sushi|salmon|cod|halibut|tuna|seafood|mussel|clam',
    grapes: ['Sauvignon Blanc', 'Albariño', 'Grüner Veltliner', 'Pinot Grigio', 'Chablis'], types: ['White', 'Sparkling'], why: 'Crisp, citrusy whites act like a squeeze of lemon on seafood.',
    drinks: ['gin-rickey', 'martini-dry', 'gimlet', 'tom-collins', 'daiquiri'], zp: 'zp-nojito' },
  greens: { label: 'Salad, vegetables or herbs', match: 'salad|greens|vegetable|veggie|asparagus|herb|pesto|chimichurri|salsa verde|green',
    grapes: ['Sauvignon Blanc', 'Grüner Veltliner'], types: ['White', 'Rosé'], why: 'Crisp, zesty wines mirror the fresh herbs.',
    drinks: ['gimlet', 'mojito', 'gin-rickey', 'tom-collins'], zp: 'zp-nojito' },
  creamy: { label: 'Creamy or buttery', match: 'cream|alfredo|carbonara|butter|bechamel|béchamel|risotto|mac|gratin|chowder|bisque',
    grapes: ['Chardonnay', 'Chenin Blanc', 'Champagne'], types: ['White', 'Sparkling'], why: 'High-acid wines cut through richness and keep things balanced.',
    drinks: ['french-75', 'sidecar', 'whiskey-sour'], zp: 'zp-strawberry-lemonade' },
  tomato: { label: 'Tomato or red sauce', match: 'tomato|marinara|pizza|bolognese|lasagna|shakshuka|red sauce|parm',
    grapes: ['Chianti', 'Sangiovese', 'Barbera', 'Tempranillo'], types: ['Red'], why: 'High-acid reds match the acidity of tomatoes so nothing tastes flat.',
    drinks: ['negroni', 'negroni-spagliato', 'boulevardier'], zp: 'zp-cran-spritz' },
  poultry: { label: 'Chicken, turkey or pork', match: 'chicken|turkey|pork|duck|quail|ham|carnitas',
    grapes: ['Pinot Noir', 'Chardonnay', 'Gamay', 'Rosé'], types: ['Red', 'White', 'Rosé'], why: 'Lighter reds and fuller whites have enough body without covering the meat.',
    drinks: ['whiskey-sour', 'tom-collins', 'french-75', 'old-fashioned'], zp: 'zp-mule' },
  redmeat: { label: 'Steak, lamb or rich gravy', match: 'steak|beef|lamb|ribeye|filet|roast|short rib|brisket|burger|gravy|jus|venison|barbacoa',
    grapes: ['Cabernet Sauvignon', 'Syrah', 'Malbec', 'Châteauneuf', 'Shiraz'], types: ['Red'], why: 'Structured reds can stand up to bold, deep flavors.',
    drinks: ['old-fashioned', 'boulevardier', 'negroni'], neat: ['bourbon', 'rye'], zp: 'zp-mule' },
  spicy: { label: 'Spicy', match: 'spicy|curry|thai|szechuan|sichuan|jalape|chorizo|buffalo|hot sauce|cajun|chili|taco|enchilada|mole',
    grapes: ['Riesling', 'Gewürztraminer', 'Gamay', 'Grenache'], types: ['White', 'Red'], why: 'Off-dry whites cool things down. Juicy reds keep the peace.',
    drinks: ['margarita', 'paloma', 'moscow-mule', 'dark-stormy'], zp: 'zp-paloma' },
  smoky: { label: 'Grilled or smoky BBQ', match: 'grill|bbq|barbecue|smoked|smoky|char|ribs|pulled',
    grapes: ['Zinfandel', 'Malbec', 'Syrah', 'Shiraz'], types: ['Red'], why: 'Ripe, fruity reds stand up to smoke and char.',
    drinks: ['old-fashioned', 'dark-stormy', 'paloma'], neat: ['bourbon'], zp: 'zp-mule' },
  cheese: { label: 'Cheese board', match: 'cheese|brie|charcuterie|cheddar|gouda|blue|manchego|board',
    grapes: ['Champagne', 'Prosecco', 'Chardonnay', 'Cabernet Sauvignon'], types: ['Sparkling', 'White', 'Red', 'Dessert'], why: 'Match the wine to the cheese: bubbles for soft cheese, bigger reds for aged ones.',
    drinks: ['boulevardier', 'sidecar', 'old-fashioned'], neat: ['cognac', 'bourbon'], zp: 'zp-cran-spritz' },
  chocolate: { label: 'Chocolate or coffee dessert', match: 'chocolate|brownie|mocha|tiramisu|coffee|fudge|lava',
    grapes: ['Port', 'Late Harvest'], types: ['Dessert', 'Red'], why: 'The drink should be at least as sweet as the dessert, or both taste sour.',
    drinks: ['espresso-martini', 'chocolate-raspberry-martini', 'white-russian'], zp: 'zp-espresso-tonic' },
  fruit: { label: 'Fruit or light dessert', match: 'fruit|berry|berries|peach|lemon|tart|sorbet|cheesecake|pie|pavlova|shortcake|cake',
    grapes: ['Moscato', 'Prosecco', 'Sauternes'], types: ['Dessert', 'Sparkling'], why: 'Light, fruity bubbles echo the fruit without overpowering it.',
    drinks: ['bellini', 'kir-royale', 'french-martini', 'strawberry-lemon-drop'], zp: 'zp-strawberry-lemonade' },
  digestif: { label: 'After-dinner sip', match: 'digestif|nightcap|after dinner|coffee service',
    grapes: ['Port'], types: ['Dessert'], why: 'A small, slow pour to end the night.',
    drinks: ['espresso-martini', 'god-mother', 'sidecar'], neat: ['cognac', 'bourbon', 'amaretto', 'limoncello'], zp: 'zp-espresso-tonic' },
};
window.AL_COURSE_DEFAULT = { 'Welcome drink': 'aperitif', 'Appetizer': 'salty', 'Soup or salad': 'greens', 'Main course': 'poultry', 'Cheese': 'cheese', 'Dessert': 'chocolate', 'After dinner': 'digestif' };
