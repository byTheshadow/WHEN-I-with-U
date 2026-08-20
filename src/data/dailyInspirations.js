export const dailyInspirations = [
  "In your presence, time finds its softest rhythm.",
  "The quietest moments often carry the deepest strength.",
  "Wherever you are, remember to breathe and be gentle with yourself.",
  "Soft light falls through the leaves, reminding us that grace is everywhere.",
  "The wind carries no rush today. Step softly into this moment.",
  "Stars shine not because they hurry, but because they are constant.",
  "A quiet heart makes room for all the warmth of the world."
];

export const getRandomInspiration = () => {
  const index = Math.floor(Math.random() * dailyInspirations.length);
  return dailyInspirations[index];
};

export default dailyInspirations;
