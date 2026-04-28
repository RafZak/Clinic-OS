export type ReplaySpeaker = "practitioner" | "patient";

export type ReplayTurn = {
  speaker: ReplaySpeaker;
  text: string;
  pauseMsBefore?: number;
};

export type ReplayScenario = {
  slug: string;
  label: string;
  practitionerName: string;
  patientLabel: string;
  patientAge: number;
  patientStatus: "prospect" | "patient" | "lost";
  targetScore: number;
  targetDurationSeconds: number;
  summary: string;
  turns: ReplayTurn[];
};

export type TimedLine = {
  speaker: ReplaySpeaker;
  text: string;
  startMs: number;
  endMs: number;
};

const WPM_PRACTITIONER = 200;
const WPM_PATIENT = 160;
const DEFAULT_PAUSE_MS = 700;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function computeTimedLines(turns: ReplayTurn[]): TimedLine[] {
  const lines: TimedLine[] = [];
  let cursor = 0;
  for (const turn of turns) {
    const pause = turn.pauseMsBefore ?? DEFAULT_PAUSE_MS;
    cursor += pause;
    const wpm = turn.speaker === "practitioner" ? WPM_PRACTITIONER : WPM_PATIENT;
    const words = countWords(turn.text);
    const durationMs = Math.max(1200, Math.round((words * 60000) / wpm));
    const startMs = cursor;
    const endMs = cursor + durationMs;
    lines.push({ speaker: turn.speaker, text: turn.text, startMs, endMs });
    cursor = endMs;
  }
  return lines;
}

export function estimateDurationSeconds(turns: ReplayTurn[]): number {
  const timed = computeTimedLines(turns);
  const last = timed[timed.length - 1];
  return last ? Math.round(last.endMs / 1000) : 0;
}

// ============================================================
// Scenario 1 — Mme Durand — excellent case (target score 88)
// ============================================================

const DURAND_TURNS: ReplayTurn[] = [
  { speaker: "practitioner", text: "Bonjour Madame Durand, entrez je vous en prie. Installez-vous. Vous avez trouvé facilement ?", pauseMsBefore: 300 },
  { speaker: "patient", text: "Oui oui, pas de souci. Merci." },
  { speaker: "practitioner", text: "Alors on va prendre une petite heure ensemble pour faire le point. Je m'appelle Jonathan Goldminc, je suis votre audioprothésiste. On va d'abord discuter de ce qui vous amène, puis on passera en cabine pour regarder votre audition. Ensuite je vous présenterai ce qui peut vous aider. Ça vous convient ?" },
  { speaker: "patient", text: "Oui, très bien." },
  { speaker: "practitioner", text: "Vous venez avec l'ordonnance de votre ORL ?" },
  { speaker: "patient", text: "Oui, voilà." },
  { speaker: "practitioner", text: "Merci. Docteur Berthier, on le connaît bien. Il me note une perte bilatérale avec plus de gêne à droite. Avant qu'on regarde ensemble, racontez-moi un peu. Qu'est-ce qui se passe au quotidien ?", pauseMsBefore: 900 },
  { speaker: "patient", text: "Eh bien, je n'entends plus très bien. Surtout quand il y a du monde. Au restaurant par exemple, avec mes enfants, ça devient compliqué.", pauseMsBefore: 1000 },
  { speaker: "practitioner", text: "D'accord. Vous allez souvent au restaurant ?" },
  { speaker: "patient", text: "On y va une fois par semaine avec mon mari, et tous les dimanches chez ma fille, on est souvent huit ou dix." },
  { speaker: "practitioner", text: "Ok. Et chez votre fille, quand tout le monde parle en même temps, qu'est-ce qui vous gêne le plus ?" },
  { speaker: "patient", text: "Je décroche. Je fais semblant de suivre mais en fait j'ai perdu le fil. Mes petits-enfants surtout, ils parlent vite et je leur fais répéter, ça les embête.", pauseMsBefore: 1000 },
  { speaker: "practitioner", text: "Et vous, ça vous embête aussi je suppose." },
  { speaker: "patient", text: "Oui. Ça me fatigue beaucoup. Je rentre crevée." },
  { speaker: "practitioner", text: "C'est très classique ce que vous décrivez. C'est ce qu'on appelle la fatigue auditive, le cerveau travaille deux fois plus pour compenser. Et en dehors des repas ?", pauseMsBefore: 900 },
  { speaker: "patient", text: "La télévision. Mon mari me dit que je mets trop fort. Et puis au théâtre, on y va avec une amie, je perds des répliques." },
  { speaker: "practitioner", text: "Le théâtre c'est un contexte intéressant, il y a souvent une amplification mais mal placée. Et au téléphone ?" },
  { speaker: "patient", text: "Ça va, sauf quand c'est ma belle-fille qui parle vite. Mais globalement ça va." },
  { speaker: "practitioner", text: "Musique, concerts ?" },
  { speaker: "patient", text: "Non. On écoute un peu de classique le soir, c'est tout." },
  { speaker: "practitioner", text: "Dernière question, la plus importante : si dans trois mois on se revoit et que vous me dites ça, ça a changé, ce serait quoi ?", pauseMsBefore: 1400 },
  { speaker: "patient", text: "Oh... pouvoir rentrer dans la conversation chez ma fille. Ne plus faire semblant.", pauseMsBefore: 1800 },
  { speaker: "practitioner", text: "Noté. On passe en cabine. Je vais vous faire écouter différents sons, vous me direz quand vous les entendez. Et après on fera un test d'intelligibilité dans le bruit, qui va montrer ce qui se passe concrètement chez votre fille." },
  { speaker: "patient", text: "Très bien." },
  { speaker: "practitioner", text: "Voilà. Respirez normalement, vous appuyez sur le bouton à chaque fois que vous entendez un son, même très léger.", pauseMsBefore: 3500 },
  { speaker: "practitioner", text: "Alors, je vous présente vos résultats. Vous avez une perte modérée à sévère sur les aigus, c'est ce que confirme votre ORL. Et surtout, au test dans le bruit, vous perdez 60 pour cent d'intelligibilité. C'est énorme, et c'est exactement ce qui vous fait décrocher chez votre fille.", pauseMsBefore: 2500 },
  { speaker: "patient", text: "60 pour cent ? Je pensais pas que c'était tant que ça.", pauseMsBefore: 1200 },
  { speaker: "practitioner", text: "C'est normal, on compense sans s'en rendre compte pendant des années. Je vais vous faire écouter quelque chose. Je simule un repas de famille, d'abord avec un appareil classe 1 qui est le niveau d'entrée, puis avec un classe 2 plus avancé. Vous me direz.", pauseMsBefore: 2000 },
  { speaker: "patient", text: "Oh. Oh, c'est impressionnant la différence avec le deuxième.", pauseMsBefore: 1800 },
  { speaker: "practitioner", text: "Oui. Le premier amplifie le son de manière globale. Le deuxième a 20 canaux, il traite le bruit en temps réel et met en avant les voix. Dans le contexte qu'on vient de simuler, c'est l'écart entre je suis dans la pièce et je participe à la conversation." },
  { speaker: "practitioner", text: "Compte tenu de ce que vous m'avez dit, les repas à dix, le théâtre, la fatigue en fin de journée, je vous recommande le Phonak Lumity en classe 2. C'est un appareil sur mesure, rechargeable, qui gère très bien les environnements complexes que vous fréquentez.", pauseMsBefore: 1200 },
  { speaker: "patient", text: "Classe 2 c'est le deuxième que j'ai entendu ?" },
  { speaker: "practitioner", text: "Oui exactement. L'écart est important dans les contextes bruyants, et c'est précisément là où vous êtes gênée." },
  { speaker: "patient", text: "Et ça coûte combien ?", pauseMsBefore: 1000 },
  { speaker: "practitioner", text: "Le Phonak Lumity est à 1 790 euros par oreille, donc 3 580 euros pour les deux. La Sécurité sociale prend 240 euros par oreille. Vous avez quelle mutuelle ?" },
  { speaker: "patient", text: "J'ai la MGEN, niveau 3 je crois." },
  { speaker: "practitioner", text: "La MGEN niveau 3 sur l'audio, c'est très correct. Elle rembourse environ 1 100 euros par oreille sur un classe 2. Ça laisse un reste à charge de 450 euros par oreille, soit 900 euros à vous pour les deux appareils.", pauseMsBefore: 1000 },
  { speaker: "patient", text: "900 euros, c'est un investissement quand même.", pauseMsBefore: 1500 },
  { speaker: "practitioner", text: "Oui, c'est un vrai sujet. Laissez-moi vous donner un repère : l'appareil est garanti 4 ans, renouvelable ensuite. Sur 4 ans, ça fait 225 euros par an, soit un peu moins de 20 euros par mois. Pour remettre en perspective, c'est ce que vous mettez sans doute dans un café restaurant avec votre amie après le théâtre.", pauseMsBefore: 1000 },
  { speaker: "patient", text: "C'est vrai vu comme ça." },
  { speaker: "practitioner", text: "Et surtout ce n'est pas une dépense récurrente comme un abonnement. Vous l'oubliez au bout de deux mois. Ce qui reste, c'est le dimanche chez votre fille où vous suivez la conversation. Je ne dis pas ça pour vous pousser, je le dis parce que c'est ce que mes patients me renvoient." },
  { speaker: "patient", text: "D'accord.", pauseMsBefore: 1200 },
  { speaker: "practitioner", text: "Si le reste à charge est un vrai frein, il existe aussi un Phonak classe 2 entrée de gamme à 1 100 euros l'oreille, soit environ 200 euros de reste à charge pour les deux. La différence dans votre contexte reste sensible mais pas totalement rédhibitoire. C'est un vrai choix que je vous laisse." },
  { speaker: "patient", text: "Non, je préfère le premier. Si c'est pour le faire, autant le faire bien.", pauseMsBefore: 1400 },
  { speaker: "practitioner", text: "Parfait. Je pense que c'est le bon choix pour vos usages." },
  { speaker: "practitioner", text: "On va faire comme ça : on prend les empreintes aujourd'hui, vous me laissez 10 jours pour la fabrication, et on se revoit pour l'adaptation. Je vous programme les appareils sur mesure pour vos usages, un programme restaurant, un programme TV, un programme général. Et vous partez avec pour 30 jours d'essai chez vous.", pauseMsBefore: 800 },
  { speaker: "patient", text: "30 jours pour les tester ?" },
  { speaker: "practitioner", text: "Oui. 30 jours, vous les portez dans votre quotidien. Si au bout de 30 jours vous n'êtes pas convaincue, on rend, vous n'avez rien à payer sauf les empreintes. C'est un essai sans engagement." },
  { speaker: "patient", text: "Ah, c'est rassurant." },
  { speaker: "practitioner", text: "Et après l'adaptation, je vous vois à J plus 15 et J plus 30 pour ajuster les réglages dans le bruit. Il y a un petit apprentissage, votre cerveau réapprend à entendre certains sons qu'il a oubliés. Je vous réserve déjà le créneau du samedi 9 mai à 10 heures 30, si ça vous va." },
  { speaker: "patient", text: "Parfait." },
  { speaker: "practitioner", text: "Dernière chose : une fois que vous décidez de garder après les 30 jours, je fais le dossier avec le logiciel, pour la Sécu et votre mutuelle. Vous n'avez rien à avancer de plus, vous réglez juste le reste à charge à ce moment-là." },
  { speaker: "patient", text: "Très bien, je vous remercie." },
  { speaker: "practitioner", text: "Avant qu'on prenne les empreintes, vous avez une question ?", pauseMsBefore: 900 },
  { speaker: "patient", text: "Non, je crois que c'est clair. J'avais un peu peur en venant je vous avoue." },
  { speaker: "practitioner", text: "C'est totalement normal. Vous verrez, dans deux mois on en rira. On y va ?" },
  { speaker: "patient", text: "On y va." },
];

// ============================================================
// Scenario 2 — M. Martin — medium case (target score 65)
// ============================================================

const MARTIN_TURNS: ReplayTurn[] = [
  { speaker: "practitioner", text: "Bonjour Monsieur Martin, entrez. Ça va ?", pauseMsBefore: 300 },
  { speaker: "patient", text: "Bonjour, oui ça va merci." },
  { speaker: "practitioner", text: "Installez-vous. Alors vous avez l'ordonnance de votre médecin ?" },
  { speaker: "patient", text: "Oui voilà. Je l'ai eue il y a 3 semaines." },
  { speaker: "practitioner", text: "Parfait. Docteur Fontaine, surdité bilatérale, ok. Alors expliquez-moi un peu ce qui vous gêne." },
  { speaker: "patient", text: "Ben ça fait un moment que j'entends moins bien. Ma femme me le dit. Et surtout la télé, je mets le son fort.", pauseMsBefore: 800 },
  { speaker: "practitioner", text: "D'accord. Ça fait combien de temps ?" },
  { speaker: "patient", text: "Oh... 3 ou 4 ans. Mais là ça devient vraiment embêtant." },
  { speaker: "practitioner", text: "La télé, c'est le premier signe en général. Et à part ça ?" },
  { speaker: "patient", text: "Les conversations dans la rue, parfois. Quand il y a du bruit. Mais ça va encore." },
  { speaker: "practitioner", text: "D'accord. Vous avez 72 ans, à la retraite j'imagine ?" },
  { speaker: "patient", text: "Oui, ancien prof de lettres." },
  { speaker: "practitioner", text: "Très bien. Bon, on va faire le bilan ensemble, on passe en cabine.", pauseMsBefore: 3000 },
  { speaker: "practitioner", text: "Alors vos résultats : perte modérée sur les aigus, classique pour votre âge. Rien d'alarmant, mais ça explique la télé et les voix aiguës que vous captez moins.", pauseMsBefore: 1500 },
  { speaker: "patient", text: "Voilà, ma petite-fille par exemple, je la comprends pas toujours." },
  { speaker: "practitioner", text: "Ah vous avez des petits-enfants ?" },
  { speaker: "patient", text: "Oui trois. Ils viennent le week-end souvent." },
  { speaker: "practitioner", text: "Super. Bon, vous allez voir, avec des appareils ça va changer. Je vais vous proposer l'offre 100 pour cent santé, le Oticon Zircon. C'est un appareil qui fait très bien le boulot, rechargeable, avec 8 canaux pour gérer les environnements. Et l'intérêt majeur : dans le cadre du 100 pour cent santé, vous n'avez aucun reste à charge. Rien, zéro.", pauseMsBefore: 700 },
  { speaker: "patient", text: "Zéro ?" },
  { speaker: "practitioner", text: "Zéro. La Sécu et votre mutuelle prennent tout en charge." },
  { speaker: "patient", text: "Ah oui, d'accord. C'est intéressant." },
  { speaker: "practitioner", text: "La contrepartie c'est que c'est un appareil d'entrée de gamme, mais pour un usage classique, télévision et conversations, il fait très bien le travail." },
  { speaker: "patient", text: "Et donc ça couvrira mon cas ?" },
  { speaker: "practitioner", text: "Largement, oui.", pauseMsBefore: 700 },
  { speaker: "patient", text: "D'accord. C'est vraiment 0 euro ?" },
  { speaker: "practitioner", text: "0 euro, y compris les accus rechargeables, donc pas de coût supplémentaire sur la durée." },
  { speaker: "patient", text: "Bon alors c'est bien." },
  { speaker: "practitioner", text: "On part là-dessus ?" },
  { speaker: "patient", text: "Oui, allons-y." },
  { speaker: "practitioner", text: "Parfait. Je vais prendre vos empreintes, compter 10 jours de fabrication, et on se revoit pour l'adaptation. Vous aurez 30 jours d'essai chez vous. Si vraiment ça ne convient pas, on ajuste ou on rend." },
  { speaker: "patient", text: "D'accord." },
  { speaker: "practitioner", text: "Ma secrétaire va vous prendre un RDV pour l'adaptation, puis deux contrôles à J plus 15 et J plus 30. Ça marche ?" },
  { speaker: "patient", text: "Ça marche. C'est vraiment pas cher du tout." },
  { speaker: "practitioner", text: "C'est l'intérêt du 100 pour cent santé oui. Beaucoup ne le savent pas encore." },
  { speaker: "patient", text: "Ma femme va être contente." },
  { speaker: "practitioner", text: "Je prends les empreintes et je vous montre l'application mobile, vous pourrez régler le volume depuis votre téléphone." },
  { speaker: "patient", text: "J'ai pas un smartphone très récent, ça marche sur les anciens ?" },
  { speaker: "practitioner", text: "Bluetooth 5.0 requis. Vous avez quoi comme modèle ?" },
  { speaker: "patient", text: "Un iPhone de 2 ans." },
  { speaker: "practitioner", text: "Parfait, ça marchera. On y va ?" },
  { speaker: "patient", text: "On y va." },
];

// ============================================================
// Scenario 3 — Mme Lefèvre — price objection failure (target score 48)
// ============================================================

const LEFEVRE_TURNS: ReplayTurn[] = [
  { speaker: "practitioner", text: "Bonjour Madame Lefèvre. Entrez, je vous en prie.", pauseMsBefore: 300 },
  { speaker: "patient", text: "Bonjour. Merci." },
  { speaker: "practitioner", text: "Installez-vous. Alors votre ordonnance ?" },
  { speaker: "patient", text: "Voilà." },
  { speaker: "practitioner", text: "Docteur Lambert, parfait. Alors qu'est-ce qui vous amène ?" },
  { speaker: "patient", text: "Eh bien, ça fait un moment que j'entends moins bien. Surtout au travail, en réunion. Je suis à la mairie, secrétaire de direction, et parfois je loupe des choses.", pauseMsBefore: 900 },
  { speaker: "practitioner", text: "D'accord. Vous avez 64 ans c'est ça ?" },
  { speaker: "patient", text: "64, oui." },
  { speaker: "practitioner", text: "Encore en activité donc, très bien. Bon, on va faire un bilan rapide en cabine. Vous me direz quand vous entendez les sons.", pauseMsBefore: 3000 },
  { speaker: "practitioner", text: "Alors votre audition. Vous avez une perte modérée des deux côtés, sur les fréquences aiguës principalement. C'est classique, et l'appareillage va bien vous aider en réunion." },
  { speaker: "patient", text: "D'accord." },
  { speaker: "practitioner", text: "Je vais vous proposer le Phonak Audéo Lumity. C'est un appareil très performant, 20 canaux, excellent dans la parole en milieu bruyant. 1 650 euros par oreille, donc 3 300 euros au total.", pauseMsBefore: 1200 },
  { speaker: "patient", text: "Oh... 3 300 euros ? Oh non là c'est vraiment beaucoup, je ne pensais pas.", pauseMsBefore: 1500 },
  { speaker: "practitioner", text: "Alors il existe l'offre 100 pour cent santé, sans aucun reste à charge. C'est un appareil classe 1, qui fait bien le travail aussi." },
  { speaker: "patient", text: "0 euro vous dites ?" },
  { speaker: "practitioner", text: "0 euro, entièrement pris en charge." },
  { speaker: "patient", text: "Ah d'accord. Mais du coup c'est le même appareil ?", pauseMsBefore: 900 },
  { speaker: "practitioner", text: "C'est un appareil d'entrée de gamme, 6 canaux au lieu de 20, mais pour une utilisation quotidienne il convient." },
  { speaker: "patient", text: "Hmm. Et la différence concrètement ?", pauseMsBefore: 1200 },
  { speaker: "practitioner", text: "La classe 2 est plus performante dans le bruit. Mais pour un usage courant, la classe 1 suffit." },
  { speaker: "patient", text: "Je ne sais pas trop. C'est un gros écart de prix quand même.", pauseMsBefore: 1500 },
  { speaker: "practitioner", text: "Oui, le 100 pour cent santé est un vrai progrès, ça a vraiment démocratisé l'appareillage." },
  { speaker: "patient", text: "Et ma mutuelle, elle prend en charge sur le Phonak ?" },
  { speaker: "practitioner", text: "Ça dépend de votre contrat. Il faudrait vous rapprocher d'eux pour savoir." },
  { speaker: "patient", text: "Je n'ai pas le détail sur moi." },
  { speaker: "practitioner", text: "Ok. On peut aussi partir sur le 100 pour cent santé et vous essayez. Si vraiment ce n'est pas assez, on peut reprendre la discussion pour monter en gamme dans 6 mois." },
  { speaker: "patient", text: "Écoutez, je vais réfléchir. Je vais en parler avec mon mari, et je verrai aussi avec la mutuelle.", pauseMsBefore: 1500 },
  { speaker: "practitioner", text: "Bien sûr. Prenez le temps." },
  { speaker: "patient", text: "Je vous rappellerai." },
  { speaker: "practitioner", text: "Très bien. On vous fait parvenir un devis par mail pour que vous ayez les chiffres." },
  { speaker: "patient", text: "Parfait." },
  { speaker: "practitioner", text: "Je vous souhaite une bonne journée." },
  { speaker: "patient", text: "Merci, au revoir." },
];

// ============================================================
// Exported scenarios
// ============================================================

export const REPLAY_SCENARIOS: ReplayScenario[] = [
  {
    slug: "durand-excellent",
    label: "Mme Durand — cas excellent",
    practitionerName: "Jonathan Goldminc",
    patientLabel: "Mme Françoise Durand",
    patientAge: 68,
    patientStatus: "prospect",
    targetScore: 88,
    targetDurationSeconds: estimateDurationSeconds(DURAND_TURNS),
    summary:
      "Parcours réussi : exploration vraie des usages, démo comparative classe 1/2, recommandation Phonak Lumity classe 2 justifiée, objection prix traitée par valeur, 30 jours d'essai pris, RDV suivi programmé.",
    turns: DURAND_TURNS,
  },
  {
    slug: "martin-upsell-rate",
    label: "M. Martin — montée en gamme ratée",
    practitionerName: "Jonathan Goldminc",
    patientLabel: "M. Henri Martin",
    patientAge: 72,
    patientStatus: "prospect",
    targetScore: 65,
    targetDurationSeconds: estimateDurationSeconds(MARTIN_TURNS),
    summary:
      "Bonne relation mais identification des besoins superficielle. Les petits-enfants et la vie sociale ne sont pas creusés. Proposition directe 100% santé sans évoquer de classe 2 alternative. Environ 1 600 € d'upsell non exploré.",
    turns: MARTIN_TURNS,
  },
  {
    slug: "lefevre-objection-price",
    label: "Mme Lefèvre — objection prix non traitée",
    practitionerName: "Jonathan Goldminc",
    patientLabel: "Mme Isabelle Lefèvre",
    patientAge: 64,
    patientStatus: "lost",
    targetScore: 48,
    targetDurationSeconds: estimateDurationSeconds(LEFEVRE_TURNS),
    summary:
      "Objection prix non travaillée : pivot immédiat vers 100% santé sans creuser la valeur, pas de démo, pas de levier mutuelle, pas de RDV de rappel. Patiente repart sans décision, risque élevé de perte définitive.",
    turns: LEFEVRE_TURNS,
  },
];

export function getScenarioBySlug(slug: string): ReplayScenario | null {
  return REPLAY_SCENARIOS.find((s) => s.slug === slug) ?? null;
}
