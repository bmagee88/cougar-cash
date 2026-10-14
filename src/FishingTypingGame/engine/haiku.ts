// Public-domain historical translations; see haiku-sources.md for provenance.
export const HAIKU_SOURCE = {
  title: 'Basho and the Japanese Poetical Epigram',
  translator: 'Basil Hall Chamberlain',
  year: 1902,
  url: 'https://thehaikufoundation.org/omeka/index.php/items/show/6080',
  scanUrl: 'https://commons.wikimedia.org/wiki/File:CNTS-00060883270_Basho_and_the_Japanese_poetical_epigram.pdf',
  textUrl: 'https://archive.org/download/transactionsasi20japagoog/transactionsasi20japagoog_djvu.txt',
  rights: 'Public domain',
} as const;

export interface Haiku {
  id: string;
  author: string;
  number: number;
  page: number;
  lines: readonly string[];
  text: string;
}

// Only typing mechanics change: retain the complete poem, expand elisions,
// remove punctuation, lowercase, and join the source's lines with spaces.
export function haikuTypingText(lines: readonly string[]): string {
  return lines.join(' ').toLowerCase().replace(/[’‘]/g, "'")
    .replace(/\bflow'r(s)?\b/g, (_, plural) => `flower${plural || ''}`)
    .replace(/\bsunflow'r\b/g, 'sunflower')
    .replace(/\bshow'r\b/g, 'shower')
    .replace(/\bheav'ns\b/g, 'heavens')
    .replace(/\bfall'n\b/g, 'fallen').replace(/\bbloom'd\b/g, 'bloomed')
    .replace(/\bfix'd\b/g, 'fixed').replace(/\bstol'n\b/g, 'stolen')
    .replace(/\bta'en\b/g, 'taken').replace(/\bo'er\b/g, 'over')
    .replace(/\bne'er\b/g, 'never').replace(/\be'en\b/g, 'even')
    .replace(/\bth'(?=\s)/g, 'the').replace(/\b2\b/g, 'two')
    .replace(/\b'tis\b|\btis\b/g, 'it is')
    .replace(/\bi'll\b/g, 'i will').replace(/\bi've\b/g, 'i have')
    .replace(/\bi'd\b/g, 'i would').replace(/\bwe'll\b/g, 'we will')
    .replace(/\bhe's\b/g, 'he is').replace(/\bit's\b/g, 'it is')
    .replace(/\bshouldn't\b/g, 'should not')
    .replace(/'/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

type Verse = readonly [number: number, author: string, page: number, ...lines: string[]];
const verses: readonly Verse[] = [
  [32, 'Bashō', 279, 'The old pond, aye! and the sound of a frog leaping into the water.'],
  [33, 'Bashō', 284, 'Sparrow, my friend, oh! do not eat', "The bees that hover o'er the flowers!"],
  [37, 'Bashō', 288, 'The end of autumn, and some rooks', 'Are perched upon a withered branch.'],
  [38, 'Bashō', 289, "Ta'en ill while journeying, I dreamt", "I wandered o'er a withered moor."],
  [46, 'Bashō', 305, 'Haply the summer grasses are', "A relic of the warriors' dream."],
  [47, 'Bashō', 309, 'A stem of grass, whereon in vain', 'A dragon-fly essayed to light!'],
  [48, 'Sōgi', 311, 'Ah! yes, my passage through the world', 'Is a mere shelter from a shower.'],
  [49, 'Sōkan', 311, 'Add but a handle to the moon,', 'And what a pretty fan it makes!'],
  [50, 'Sōkan', 311, 'Behold the water for the tea', 'Make for itself a lid of ice!'],
  [51, 'Arakida Moritake', 312, "Fall'n flow'r returning to the branch,", 'Behold! it is a butterfly.'],
  [52, 'Arakida Moritake', 312, 'Oh! fireflies, what a fiery rain', 'Commingling with the summer shower!'],
  [54, 'Arakida Moritake', 312, 'The willows which the breezes comb,', 'Are they the forelock of the bank?'],
  [59, 'Saitō Tokugen', 314, 'When spring comes, the two pine-trees stand by the gate for luck.'],
  [62, 'Mitsu-Jo', 315, 'So lovely even in its cry,', 'What were the cuckoo if it laughed?'],
  [63, 'Kōshun', 315, 'Light goes the butterfly, what time', 'A single robe is all we don.'],
  [66, 'Nishiyama Sōin', 316, 'The wild-geese in the firmament,', 'These are Dutch letters sideways stretching.'],
  [68, 'Nishiyama Sōin', 317, 'Lacking in all discernment as', 'To where they light are the white dews.'],
  [71, 'Sute-Jo', 318, 'A snowy morning, everywhere', 'The figure "2" left by the clogs.'],
  [73, 'Anonymous', 318, 'The season when the pond grows warm,', "To judge from all the fishes' heads."],
  [74, 'Bashō', 319, 'The year has closed while still I wear', "My sandals and my pilgrim's hat."],
  [75, 'Bashō', 319, 'Coming this mountain way, no herb', 'Is lovelier than the violet.'],
  [76, 'Bashō', 319, 'On looking carefully, behold', 'The caseweed flowering near the fence!'],
  [77, 'Bashō', 320, "Well then, we'll off to see the snow,", 'Far as we can without a tumble.'],
  [79, 'Bashō', 320, "Awake! awake! I'll make of thee", 'My comrade, sleeping butterfly.'],
  [82, 'Bashō', 321, 'Oh! cormorant fishing-boat so gay,', 'And then again so melancholy!'],
  [83, 'Bashō', 321, 'Cuckoo! for melancholy me', 'Oh! make still deeper loneliness.'],
  [84, 'Bashō', 322, 'A rough sea, and the Milky Way', "Stretching across to Sado's isle."],
  [85, 'Bashō', 322, 'Oh! those siestas, with my feet', 'Pressed fearsomely against the wall!'],
  [87, 'Bashō', 323, 'Oh! the moon-gazing where some clouds', 'From time to time repose the eye!'],
  [88, 'Bashō', 323, 'In the bright moonlight what appeared', 'Like flowers is a cotton-field.'],
  [89, 'Bashō', 323, 'Oh! clouds about the moon, from whence', 'She falters forth so debonnair!'],
  [90, 'Bashō', 324, 'Oh! skylark for whose carolling', 'The livelong day sufficeth not!'],
  [91, 'Bashō', 324, 'Athwart the surface of the stream', "There lieth stretched the cuckoo's voice."],
  [92, 'Bashō', 324, 'A rainy day in June, and yet', "The sunflow'r bends to the sun's course."],
  [93, 'Bashō', 324, 'Like to the booming of a bell', "When struck, is the cicada's voice."],
  [94, 'Bashō', 325, 'As, lacking oil, I lie abed', 'At night, the moon my window lights.'],
  [95, 'Bashō', 325, 'Despite that I have nine times risen,', "'Tis but the fourth hour by the moon."],
  [96, 'Bashō', 325, 'Is it hard fare, or is it love', "That makes the cat's goodwife so lean?"],
  [103, 'Ransetsu', 328, "Aye! New Year's day, with a clear sky,", 'And conversation among the sparrows!'],
  [104, 'Ransetsu', 328, 'Slowly it mildens, as the plum', 'Ventureth forth blossom by blossom.'],
  [106, 'Ransetsu', 329, 'Yellow chrysanthemums, white chrysanthemums;', 'Would there were no more names than these!'],
  [107, 'Ransetsu', 329, 'The asters bloom. Come butterflies,', "And dally o'er the colour dish!"],
  [108, 'Ransetsu', 329, 'Behold the wild-geese wending homeward,', 'Mingled with the pilgrim bands!'],
  [109, 'Ransetsu', 330, 'Oh! flowery moor, stretching athwart', "Mount Fuji's slope so pleasantly!"],
  [110, 'Kyorai', 330, 'No friends, oh! let me meet no friends', 'When I am gazing at the flowers!'],
  [113, 'Kyorai', 331, 'What haste! a shower in the offing,', 'And sails set straight, and sails set slant.'],
  [114, 'Kyorai', 331, "I will contemplate from Fushimi's", 'Abandoned castle-grounds the moon.'],
  [115, 'Kyorai', 331, "'Tis evening, and in serried file", 'Stand the bare pinnacles of cloud.'],
  [116, 'Kyorai', 332, 'Bit by a sorry mate, the cat', 'Intently gazes at the sky.'],
  [117, 'Jōsō', 332, 'How many may be hurrying through', 'The drizzle on the Bridge of Seta?'],
  [118, 'Jōsō', 332, 'Nothing remaineth; for the snow', 'Hath blotted out both moor and hill.'],
  [119, 'Jōsō', 332, 'What! mid the flowers the woodpecker', 'Is seeking out a withered tree.'],
  [120, 'Jōsō', 333, 'In autumn a cicada dead', 'Beside the shell that it cast off.'],
  [121, 'Jōsō', 333, 'Behold the leaf that sinks and clings', 'Below the water to a rock!'],
  [122, 'Jōsō', 333, 'The teal, with face fresh from the sight', 'Of what below the water lies.'],
  [124, 'Shikō', 334, 'Plum-blossoms! is it that the sap', 'Still courses through that single branch?'],
  [125, 'Shikō', 334, 'Oh! the white clouds! nay, rather blossoms,', 'Lilies that bend across the fence.'],
  [126, 'Shikō', 335, 'Weary perhaps of dolorous love,', "The cat has stol'n a bit to eat."],
  [129, 'Yaha', 335, "After I've swept and tidied up,", 'Adown fall some camellias.'],
  [130, 'Yaha', 336, 'The nightingale and, at the gate,', 'The unexpected bean-curd vendor.'],
  [131, 'Yaha', 336, 'A summer room where, lying down,', 'I see the clouds as they go past.'],
  [132, 'Hokushi', 336, 'I am burnt out. Nevertheless,', "The flow'rs have duly bloom'd and faded."],
  [133, 'Etsujin', 337, 'A brilliant moon! there was no marge', 'Betwixt it and the dawn of day.'],
  [134, 'Etsujin', 337, 'A rainy moon, and everywhere', 'Alike a faint irradiation.'],
  [135, 'Etsujin', 337, 'Oh! moonlight, with the sound of rice', 'A-pounding in the mountain temple!'],
  [136, 'Sugiyama Sampū', 338, 'Moonlight in winter, and I draw', 'My neck within my comforter.'],
  [137, 'Sugiyama Sampū', 338, 'Oh! how its young ones must be waiting,', 'For all too high ascends the lark!'],
  [138, 'Izembō', 338, 'A shower came, and so I came', 'Running indoors; then blue sky came.'],
  [139, 'Izembō', 338, 'Oh! what a heavy weight of snow,', 'Sweep as you may, sweep as you may!'],
  [140, 'Hanchō', 339, 'My razor, in a single night,', 'Is rusted by the rains of June.'],
  [141, 'Hanchō', 339, 'The movement of the world of men', "Is ceaseless as the wagtail's tail."],
  [142, 'Ryōto', 339, "Off to the cherry-flow'rs! the day", "Was fix'd; and what, though it be cloudy?"],
  [144, 'Chigetsu-ni', 340, "I'll take some barley straw and make", 'A house for you, little green frog!'],
  [145, 'Chigetsu-ni', 340, "The cherry-flow'rs! for them alone", 'Is it that life is dear to me.'],
  [146, 'Chigetsu-ni', 340, 'Oh! snowstorm, at whose blast the birds', "Begin to cry o'er sea and hill!"],
  [147, 'Kyokusui', 340, 'How carefully begin to bud', 'In winter the camellia-trees!'],
  [148, 'Otsuyu', 341, "A show'r, and skill of every sort", 'In things to put upon the head.'],
  [149, 'Otsuyu', 341, "All come at last to be a fan's", 'Old sticks when blows the autumn breeze.'],
  [150, 'Otsuyu', 341, 'He was the cuckoo. Say what other', 'Bird may sing now he is gone.'],
  [151, 'Shidō', 342, 'There, by the crescent moon, the shark', 'Has hid his head beneath the wave.'],
  [153, 'Edo-za School', 343, 'The morning hoar-frost, and Mount Fuji', 'Drawn on it with my walking-stick.'],
  [155, 'Shūshiki', 344, 'The dream I dreamt has faded, but', 'The iris keeps its colours yet.'],
  [158, 'Anonymous', 345, "Embroideries not e'en yet worn", 'Are tarnished by the rains of June.'],
  [159, 'Onitsura', 345, 'Uncanny and yet pleasing are', "These flow'rs that blossom out of time."],
  [160, 'Onitsura', 345, 'And in the summer, folks opined', 'That winter was to be preferred.'],
  [161, 'Onitsura', 346, 'Without a word of warning, there,', "In th' autumn sky, Mount Fuji stands."],
  [163, 'Onitsura', 346, 'Together with one blossom more,', 'Oh! life, thou goest on thy way.'],
  [164, 'Onitsura', 346, 'They blossom forth, and so I gaze,', 'And so these flowers fade, and so...'],
  [165, 'Ritō', 347, "The old man's autumn, who with joy", 'Hears the six strokes that tell the dawn.'],
  [166, 'Reikan', 347, 'It has no voice, the butterfly,', "Whose dream of flow'rs I fain would learn."],
  [167, 'Yūya', 347, 'And when the boatmen have made up', "Their quarrel, oh! then 'tis the frogs."],
  [168, 'Ryūbai', 347, 'Oh! little butterfly, with wings', 'Still moving even when it lights!'],
  [169, 'Shōsei', 348, "Oh! the camellia, which ne'er", 'Appears like dropping till it drops.'],
  [170, 'Chiyo', 348, 'A hundred tendrils, yea! and all', 'From the same vine that is their heart.'],
  [171, 'Yokoi Yayū', 349, 'Alas! the noon convolvulus,', 'That neither dew may aught avail!'],
  [172, 'Yokoi Yayū', 349, 'A temple on a hill, whose bell', 'At break of day startles the rooks.'],
  [173, 'Yokoi Yayū', 349, "I've seen the bogie's veritable", "Shape: it's merely withered grass."],
  [175, 'Buson', 350, 'The nightingale and dinner-time,', 'With the whole family assembled.'],
  [176, 'Buson', 350, 'Oh! distant past, made up of slow', 'But ever accumulating days!'],
  [177, 'Buson', 350, 'The snail-man, hurrying along,', 'Saw not the city which he traversed.'],
  [178, 'Buson', 351, 'The kite flies in the self-same spot', 'Of sky where yesterday it flew.'],
  [179, 'Buson', 351, "A show'r in spring, where an umbrella", 'And rain-coat walk along conversing.'],
  [180, 'Buson', 351, 'Ash-smothered coals and, at long last,', 'The gruel simmering in the pot.'],
  [181, 'Buson', 351, 'Done is the long spring day, wherein', 'The nightingale did sing afar.'],
  [182, 'Buson', 352, 'How distant on the fallen leaves', 'His footstep sounds for whom I wait!'],
  [183, 'Buson', 352, 'Some water-fowl, and in the midst', 'Of withered trees two palanquins.'],
  [186, 'Buson', 353, "Coming to see the flow'rs, I sleep", 'Beneath the flowers, being free.'],
  [188, 'Ryōta', 354, 'In the June rains, as if by stealth,', 'One night the moon shines through the pines.'],
  [189, 'Ryōta', 354, "Oh! moon, if born again, I'd be", 'A pine-tree on a mountain peak.'],
  [190, 'Rankō', 354, "'Tis July, and on every side", 'Nothing but rivers of hot water.'],
  [191, 'Rankō', 355, 'To ice all crimson red has frozen', 'The rime upon the buckwheat stems.'],
  [192, 'Rankō', 355, 'The withered reeds, that day by day', 'Break off, are floated down the stream.'],
  [193, 'Gyōtai', 355, "On Matsushima's thousand isles", 'The Lord of Mutsu takes the cool.'],
  [194, 'Gyōtai', 356, 'Where shine the stars that wend along', "The heav'ns, there doth the sea-gull cry."],
  [195, 'Shirō', 356, "Around the plum-flow'rs make a fence,", "To stay the nightingale's return."],
  [196, 'Etsujin (1760–1836)', 356, 'A flash of lightning, and no time', 'To write the one word "Etsujin."'],
  [197, 'Issa', 357, 'You little sparrows left without', 'A mother, come and play with me.'],
  [199, 'Issa', 358, 'Emaciated frog! be not', 'Worsted in fight: Issa is here.'],
  [200, 'Issa', 358, "Hallo! you shouldn't cry, you storks,", 'Returning home so safe and sound!'],
  [201, 'Sō-a', 358, "Cherry-flow'rs sunset-lit: I turn", 'And gaze, my breast upon my staff.'],
  [202, 'Keirin', 359, 'If but the wheel be diligent,', 'The water has no time to freeze.'],
  [203, 'Gomei', 359, 'Of course the nightingale stays not', 'Upon a tree bereft of flowers.'],
];

export const HAIKU: readonly Haiku[] = verses.map(([number, author, page, ...lines]) => ({
  id: `chamberlain-1902-${number}`, number, author, page, lines, text: haikuTypingText(lines),
}));
export const HAIKU_BY_TEXT = new Map(HAIKU.map(poem => [poem.text, poem]));
