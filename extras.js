// Zero-proof drinks and the extra ingredients they use. Kept apart from
// data.js, which is generated from the spreadsheet.
(function () {
  const ING = window.AL_INGREDIENTS;
  ING['ginger-ale'] = { label: 'Ginger Ale', group: 'Mixers' };
  ING['orange-juice'] = { label: 'Orange Juice', group: 'Juices' };

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
