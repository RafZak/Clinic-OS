# Scripts replay — draft v0

Trois scénarios de consultation audioprothèse, format écrit uniquement (pas de TTS).
Destinés à être déroulés dans `ReplayConsole` avec timing simulé (~180 mots/min pour pro, ~160 mots/min pour patient, pauses 600-1800 ms selon nature du tour).

**Convention de relecture** : annoter directement dans ce fichier (Jonathan), je corrige ensuite. Une fois validé, je transpose en `scripts/replay/scripts.ts` typé.

---

## 1. Mme Durand — cas excellent (score cible 88, durée ~6 min)

**Profil patient** : Françoise Durand, 68 ans, retraitée, vie sociale active (dimanches en famille à 8-10, théâtre mensuel avec une amie). Mutuelle MGEN niveau 3. Motif : gêne dans les environnements bruyants, TV trop fort selon son mari, décrochage dans les repas de famille.

**Profil pro** : Claire Moreau, audioprothésiste expérimentée, centre Lyon 3.

**Points clés attendus côté analyse IA** :
- Étapes 1-2-3 excellentes (90+)
- Étape 7 remarquablement exécutée : objection traitée par valeur (4 ans / 20€/mois / mise en perspective)
- Étape 10 (suivi) ancré : RDV J+15 et J+30 programmés
- 1-2 insights "good_practice" à valeur pédagogique

---

**1. Pro** — Bonjour Madame Durand, entrez je vous en prie. Installez-vous. Vous avez trouvé facilement ?
**2. Patiente** — Oui oui, pas de souci. Merci.
**3. Pro** — Alors on va prendre une petite heure ensemble pour faire le point. Je m'appelle Claire Moreau, je suis votre audioprothésiste. On va d'abord discuter de ce qui vous amène, puis on passera en cabine pour regarder votre audition. Ensuite je vous présenterai ce qui peut vous aider. Ça vous convient ?
**4. Patiente** — Oui, très bien.
**5. Pro** — Vous venez avec l'ordonnance de votre ORL ?
**6. Patiente** — Oui, voilà.
**7. Pro** — Merci. Docteur Berthier, on le connaît bien. Il me note une perte bilatérale avec plus de gêne à droite. Avant qu'on regarde ensemble... racontez-moi un peu. Qu'est-ce qui se passe au quotidien ?
**8. Patiente** — Eh bien, je n'entends plus très bien. Surtout quand il y a du monde. Au restaurant par exemple, avec mes enfants, ça devient compliqué.
**9. Pro** — D'accord. Vous allez souvent au restaurant ?
**10. Patiente** — On y va une fois par semaine avec mon mari, et tous les dimanches chez ma fille, on est souvent 8 ou 10.
**11. Pro** — Ok. Et chez votre fille, quand tout le monde parle en même temps, qu'est-ce qui vous gêne le plus ?
**12. Patiente** — Je décroche. Je fais semblant de suivre mais en fait j'ai perdu le fil. Mes petits-enfants surtout, ils parlent vite et je leur fais répéter, ça les embête.
**13. Pro** — Et vous, ça vous embête aussi je suppose.
**14. Patiente** — Oui. Ça me fatigue beaucoup. Je rentre crevée.
**15. Pro** — C'est très classique ce que vous décrivez. C'est ce qu'on appelle la fatigue auditive, le cerveau travaille deux fois plus pour compenser. Et en dehors des repas ?
**16. Patiente** — La télévision. Mon mari me dit que je mets trop fort. Et puis au théâtre, on y va avec une amie, je perds des répliques.
**17. Pro** — Le théâtre c'est un contexte intéressant, il y a souvent une amplification mais mal placée. Et au téléphone ?
**18. Patiente** — Ça va, sauf quand c'est ma belle-fille qui parle vite. Mais globalement ça va.
**19. Pro** — Musique, concerts ?
**20. Patiente** — Non. On écoute un peu de classique le soir, c'est tout.
**21. Pro** — Dernière question, la plus importante : si dans 3 mois on se revoit et que vous me dites "ça, ça a changé", ce serait quoi ?
**22. Patiente** — Oh... pouvoir rentrer dans la conversation chez ma fille. Ne plus faire semblant.
**23. Pro** — Noté. On passe en cabine. Je vais vous faire écouter différents sons, vous me direz quand vous les entendez. Et après on fera un test d'intelligibilité dans le bruit, qui va montrer ce qui se passe concrètement chez votre fille.
**24. Patiente** — Très bien.
**25. Pro** — Voilà. Respirez normalement, vous appuyez sur le bouton à chaque fois que vous entendez un son, même très léger.

*[passage cabine, résumé]*

**26. Pro** — Alors, je vous présente vos résultats. Vous avez une perte modérée à sévère sur les aigus, c'est ce que confirme votre ORL. Et surtout, au test dans le bruit, vous perdez 60 % d'intelligibilité. C'est énorme, et c'est exactement ce qui vous fait décrocher chez votre fille.
**27. Patiente** — 60 % ? Je pensais pas que c'était tant que ça.
**28. Pro** — C'est normal, on compense sans s'en rendre compte pendant des années. Je vais vous faire écouter quelque chose. Je simule un repas de famille, d'abord avec un appareil classe 1 qui est le niveau d'entrée, puis avec un classe 2 plus avancé. Vous me direz.

*[démo en cabine]*

**29. Patiente** — Oh. Oh, c'est impressionnant la différence avec le deuxième.
**30. Pro** — Oui. Le premier amplifie le son de manière globale. Le deuxième a 20 canaux, il traite le bruit en temps réel et met en avant les voix. Dans le contexte qu'on vient de simuler, c'est l'écart entre "je suis dans la pièce" et "je participe à la conversation".
**31. Pro** — Compte tenu de ce que vous m'avez dit — les repas à 10, le théâtre, la fatigue en fin de journée — je vous recommande le Phonak Lumity en classe 2. C'est un appareil sur mesure, rechargeable, qui gère très bien les environnements complexes que vous fréquentez.
**32. Patiente** — Classe 2 c'est le deuxième que j'ai entendu ?
**33. Pro** — Oui exactement. L'écart est important dans les contextes bruyants, et c'est précisément là où vous êtes gênée.
**34. Patiente** — Et ça coûte combien ?
**35. Pro** — Le Phonak Lumity est à 1 790 € par oreille, donc 3 580 € pour les deux. La Sécurité sociale prend 240 € par oreille. Vous avez quelle mutuelle ?
**36. Patiente** — J'ai la MGEN, niveau 3 je crois.
**37. Pro** — La MGEN niveau 3 sur l'audio, c'est très correct. Elle rembourse environ 1 100 € par oreille sur un classe 2. Ça laisse un reste à charge de 450 € par oreille, soit 900 € à vous pour les deux appareils.
**38. Patiente** — 900 €... c'est un investissement quand même.
**39. Pro** — Oui, c'est un vrai sujet. Laissez-moi vous donner un repère : l'appareil est garanti 4 ans, renouvelable ensuite. Sur 4 ans, ça fait 225 € par an, soit un peu moins de 20 € par mois. Pour remettre en perspective, c'est ce que vous mettez sans doute dans un café-restaurant avec votre amie après le théâtre.
**40. Patiente** — C'est vrai vu comme ça.
**41. Pro** — Et surtout ce n'est pas une dépense récurrente comme un abonnement. Vous l'oubliez au bout de deux mois. Ce qui reste, c'est le dimanche chez votre fille où vous suivez la conversation. Je ne dis pas ça pour vous pousser, je le dis parce que c'est ce que mes patients me renvoient.
**42. Patiente** — D'accord.
**43. Pro** — Si le reste à charge est un vrai frein, il existe aussi un Phonak classe 2 entrée de gamme à 1 100 € l'oreille, soit environ 200 € de reste à charge pour les deux. La différence dans votre contexte reste sensible mais pas totalement rédhibitoire. C'est un vrai choix que je vous laisse.
**44. Patiente** — Non, je préfère le premier. Si c'est pour le faire, autant le faire bien.
**45. Pro** — Parfait. Je pense que c'est le bon choix pour vos usages.
**46. Pro** — On va faire comme ça : on prend les empreintes aujourd'hui, vous me laissez 10 jours pour la fabrication, et on se revoit pour l'adaptation. Je vous programme les appareils sur mesure pour vos usages — un programme restaurant, un programme TV, un programme général. Et vous partez avec pour 30 jours d'essai chez vous.
**47. Patiente** — 30 jours pour les tester ?
**48. Pro** — Oui. 30 jours, vous les portez dans votre quotidien. Si au bout de 30 jours vous n'êtes pas convaincue, on rend, vous n'avez rien à payer sauf les empreintes. C'est un essai sans engagement.
**49. Patiente** — Ah, c'est rassurant.
**50. Pro** — Et après l'adaptation, je vous vois à J+15 et J+30 pour ajuster les réglages dans le bruit. Il y a un petit apprentissage, votre cerveau réapprend à entendre certains sons qu'il a oubliés. Je vous réserve déjà le créneau du samedi 9 mai à 10h30, si ça vous va.
**51. Patiente** — Parfait.
**52. Pro** — Dernière chose : une fois que vous décidez de garder après les 30 jours, je fais le dossier avec le logiciel, pour la Sécu et votre mutuelle. Vous n'avez rien à avancer de plus, vous réglez juste le reste à charge à ce moment-là.
**53. Patiente** — Très bien, je vous remercie.
**54. Pro** — Avant qu'on prenne les empreintes, vous avez une question ?
**55. Patiente** — Non, je crois que c'est clair. J'avais un peu peur en venant je vous avoue.
**56. Pro** — C'est totalement normal. Vous verrez, dans 2 mois on en rira. On y va ?
**57. Patiente** — On y va.

---

## 2. M. Martin — cas moyen (score cible 65, durée ~5 min)

**Profil patient** : Henri Martin, 72 ans, ancien professeur de lettres, retraité. 3 petits-enfants qui viennent le week-end. Motif : TV trop fort, gêne conversationnelle. Aucune attente formulée au-delà.

**Profil pro** : audioprothésiste sympathique mais qui prend la demande à face value. Ne creuse pas les usages (petits-enfants, vie sociale, activités), ne propose **jamais** le classe 2 en option, pivote directement vers 100 % santé dès le bilan — alors que le patient a les usages et potentiellement les moyens qui justifieraient une montée en gamme.

**Points clés attendus côté analyse IA** :
- Étape 3 (identification besoins) score 40-50 : pas d'exploration des usages à forte exigence
- Étape 6 (recommandation) score 45-55 : une seule option présentée, pas d'alternative, pas de justification comparative
- Étape 7 (objections) non évaluée (pas d'objection prix soulevée → pas d'occasion)
- Insight `upsell_missed` sévérité warning chiffré **~1 600 € CA manqué** (800 €/oreille × 2, écart classe 1 vs classe 2 entrée de gamme après mutuelle type)
- Insight `improvement` sur étape 3 : "ne pas s'arrêter à la première mention des petits-enfants, creuser la fréquence et les contextes"

---

**1. Pro** — Bonjour Monsieur Martin, entrez. Ça va ?
**2. Patient** — Bonjour, oui ça va merci.
**3. Pro** — Installez-vous. Alors vous avez l'ordonnance de votre médecin ?
**4. Patient** — Oui voilà. Je l'ai eue il y a 3 semaines.
**5. Pro** — Parfait. Docteur Fontaine, surdité bilatérale, ok. Alors expliquez-moi un peu ce qui vous gêne.
**6. Patient** — Ben ça fait un moment que j'entends moins bien. Ma femme me le dit. Et surtout la télé, je mets le son fort.
**7. Pro** — D'accord. Ça fait combien de temps ?
**8. Patient** — Oh... 3-4 ans. Mais là ça devient vraiment embêtant.
**9. Pro** — La télé, c'est le premier signe en général. Et à part ça ?
**10. Patient** — Les conversations dans la rue, parfois. Quand il y a du bruit. Mais ça va encore.
**11. Pro** — D'accord. Vous avez 72 ans, à la retraite j'imagine ?
**12. Patient** — Oui, ancien prof de lettres.
**13. Pro** — Très bien. Bon, on va faire le bilan ensemble, on passe en cabine.

*[cabine, bref]*

**14. Pro** — Alors vos résultats : perte modérée sur les aigus, classique pour votre âge. Rien d'alarmant, mais ça explique la télé et les voix aiguës que vous captez moins.
**15. Patient** — Voilà, ma petite-fille par exemple, je la comprends pas toujours.
**16. Pro** — Ah vous avez des petits-enfants ?
**17. Patient** — Oui trois. Ils viennent le week-end souvent.
**18. Pro** — Super. Bon, vous allez voir, avec des appareils ça va changer. Je vais vous proposer l'offre 100 % santé, le Oticon Zircon. C'est un appareil qui fait très bien le boulot, rechargeable, avec 8 canaux pour gérer les environnements. Et l'intérêt majeur : dans le cadre du 100 % santé, vous n'avez aucun reste à charge. Rien, zéro.
**19. Patient** — Zéro ?
**20. Pro** — Zéro. La Sécu et votre mutuelle prennent tout en charge.
**21. Patient** — Ah oui, d'accord. C'est intéressant.
**22. Pro** — La contrepartie c'est que c'est un appareil d'entrée de gamme, mais pour un usage classique, télévision et conversations, il fait très bien le travail.
**23. Patient** — Et donc ça couvrira mon cas ?
**24. Pro** — Largement, oui.
**25. Patient** — D'accord. C'est vraiment 0 € ?
**26. Pro** — 0 €, y compris les accus rechargeables, donc pas de coût supplémentaire sur la durée.
**27. Patient** — Bon alors c'est bien.
**28. Pro** — On part là-dessus ?
**29. Patient** — Oui, allons-y.
**30. Pro** — Parfait. Je vais prendre vos empreintes, compter 10 jours de fabrication, et on se revoit pour l'adaptation. Vous aurez 30 jours d'essai chez vous. Si vraiment ça ne convient pas, on ajuste ou on rend.
**31. Patient** — D'accord.
**32. Pro** — Ma secrétaire va vous prendre un RDV pour l'adaptation, puis deux contrôles à J+15 et J+30. Ça marche ?
**33. Patient** — Ça marche. C'est vraiment pas cher du tout.
**34. Pro** — C'est l'intérêt du 100 % santé oui. Beaucoup ne le savent pas encore.
**35. Patient** — Ma femme va être contente.
**36. Pro** — Je prends les empreintes et je vous montre l'application mobile, vous pourrez régler le volume depuis votre téléphone.
**37. Patient** — J'ai pas un smartphone très récent, ça marche sur les anciens ?
**38. Pro** — Bluetooth 5.0 requis. Vous avez quoi comme modèle ?
**39. Patient** — Un iPhone de 2 ans.
**40. Pro** — Parfait, ça marchera. On y va ?
**41. Patient** — On y va.

---

## 3. Mme Lefèvre — objection prix non traitée (score cible 48, durée ~4 min)

**Profil patient** : Isabelle Lefèvre, 64 ans, secrétaire de direction à la mairie, en activité. Motif : gêne en réunion, perte de fil. Mutuelle jamais évoquée par le pro. Aucune démo comparative.

**Profil pro** : présente d'emblée le classe 2 au prix catalogue (1 650 €/oreille) sans avoir creusé la valeur. Dès que la patiente dit "c'est cher", **pivote sec vers le 100 % santé** sans reformuler l'objection, sans démo, sans explorer la mutuelle, sans proposer l'essai gratuit 30 jours comme levier de décision. Patiente repart "je vais réfléchir" sans RDV de rappel.

**Points clés attendus côté analyse IA** :
- Étape 3 (identification) score 50 : une seule situation évoquée (réunion), pas d'exploration vie personnelle / sociale / téléphone
- Étape 5 (bilan/démo) score 30 : pas de démo comparative classe 1 vs classe 2
- Étape 6 (recommandation) score 45 : option proposée puis abandonnée sous pression sans justification
- **Étape 7 (objections) score 15-20, sévérité critical** : le cœur de l'insight, objection prix non reformulée, pas de retour à la valeur, pas de levier mutuelle
- Étape 8 (conclusion) score 25 : pas de next step concret, pas de RDV de rappel
- Étape 10 (suivi) non évaluée (rien)
- Insight `missed_objection` critical chiffré **~1 350 € CA perdu** (écart classe 2 vs classe 1 après mutuelle moyenne) + risque perte définitive du prospect (taux de non-retour après "je vais réfléchir" sans RDV fixé ≈ 70-80 %, soit ~2 700 € d'espérance à la casse)

---

**1. Pro** — Bonjour Madame Lefèvre. Entrez, je vous en prie.
**2. Patiente** — Bonjour. Merci.
**3. Pro** — Installez-vous. Alors votre ordonnance ?
**4. Patiente** — Voilà.
**5. Pro** — Docteur Lambert, parfait. Alors qu'est-ce qui vous amène ?
**6. Patiente** — Eh bien, ça fait un moment que j'entends moins bien. Surtout au travail, en réunion. Je suis à la mairie, secrétaire de direction, et parfois je loupe des choses.
**7. Pro** — D'accord. Vous avez 64 ans c'est ça ?
**8. Patiente** — 64, oui.
**9. Pro** — Encore en activité donc, très bien. Bon, on va faire un bilan rapide en cabine. Vous me direz quand vous entendez les sons.

*[cabine, bref]*

**10. Pro** — Alors votre audition. Vous avez une perte modérée des deux côtés, sur les fréquences aiguës principalement. C'est classique, et l'appareillage va bien vous aider en réunion.
**11. Patiente** — D'accord.
**12. Pro** — Je vais vous proposer le Phonak Audéo Lumity. C'est un appareil très performant, 20 canaux, excellent dans la parole en milieu bruyant. 1 650 € par oreille, donc 3 300 € au total.
**13. Patiente** — Oh... 3 300 € ? Oh non là c'est vraiment beaucoup, je ne pensais pas.
**14. Pro** — Alors il existe l'offre 100 % santé, sans aucun reste à charge. C'est un appareil classe 1, qui fait bien le travail aussi.
**15. Patiente** — 0 € vous dites ?
**16. Pro** — 0 €, entièrement pris en charge.
**17. Patiente** — Ah d'accord. Mais du coup c'est le même appareil ?
**18. Pro** — C'est un appareil d'entrée de gamme, 6 canaux au lieu de 20, mais pour une utilisation quotidienne il convient.
**19. Patiente** — Hmm. Et la différence concrètement ?
**20. Pro** — La classe 2 est plus performante dans le bruit. Mais pour un usage courant, la classe 1 suffit.
**21. Patiente** — Je ne sais pas trop. C'est un gros écart de prix quand même.
**22. Pro** — Oui, le 100 % santé est un vrai progrès, ça a vraiment démocratisé l'appareillage.
**23. Patiente** — Et ma mutuelle, elle prend en charge sur le Phonak ?
**24. Pro** — Ça dépend de votre contrat. Il faudrait vous rapprocher d'eux pour savoir.
**25. Patiente** — Je n'ai pas le détail sur moi.
**26. Pro** — Ok. On peut aussi partir sur le 100 % santé et vous essayez. Si vraiment ce n'est pas assez, on peut reprendre la discussion pour monter en gamme dans 6 mois.
**27. Patiente** — Écoutez, je vais réfléchir. Je vais en parler avec mon mari, et je verrai aussi avec la mutuelle.
**28. Pro** — Bien sûr. Prenez le temps.
**29. Patiente** — Je vous rappellerai.
**30. Pro** — Très bien. On vous fait parvenir un devis par mail pour que vous ayez les chiffres.
**31. Patiente** — Parfait.
**32. Pro** — Je vous souhaite une bonne journée.
**33. Patiente** — Merci, au revoir.

---

## Notes de relecture — points où tu peux m'attraper

1. **Chiffres marché** : 1 790 € Lumity classe 2 / 1 650 € Audéo classe 2 / 1 100 € classe 2 entrée de gamme / MGEN niv 3 rembourse ~1 100 €/oreille → à valider par Jonathan, j'ai pris des fourchettes crédibles 2025-2026 mais il aura des chiffres plus précis du réseau.
2. **Tonalité du pro Durand** vs **pro Martin** vs **pro Lefèvre** : j'ai volontairement fait **3 pros différents** pour que les 3 sessions ne soient pas perçues comme "le même audioprothésiste à 3 niveaux d'exécution". Si Jonathan préfère **1 seul pro** (plus cohérent pour la démo "un pro qui varie selon ses contextes"), on unifie.
3. **Vocabulaire** : j'utilise "classe 1 / classe 2", "100 % santé", "sur mesure", "canaux", "empreintes", "adaptation", "J+15/J+30". Si le réseau Amplifon a des termes internes différents (ex: "catégorie A/B" au lieu de "classe 1/2"), on remplace.
4. **Durand étapes 1-2** : l'accueil est court ("entrez, installez-vous"). Si Jonathan veut une étape 1 plus riche (questions sur le trajet, prise de manteau, offre eau), on étoffe les 2-3 premiers tours.
5. **Martin** : j'ai fait démarrer l'erreur du pro à **tour 18** (propose classe 1 direct sans avoir exploré les contextes des petits-enfants). Si tu veux une erreur plus précoce (ex : au tour 11-12 le pro passe directement au bilan sans poser de question d'ouverture), je décale.
6. **Lefèvre** : j'ai caché le fait que l'objection est mal traitée dans 3 indices — tour 14 (pivot immédiat), tour 20 (justification passive "ça suffit"), tour 22 (le pro abonde dans le sens de la patiente au lieu de défendre sa reco). Si tu veux 1 ou 2 de ces indices plus marqués pour que l'IA ait des citations plus propres, on ajuste.
7. **Longueur** : Durand 57 tours, Martin 41, Lefèvre 33. En lecture simulée à ~180 mots/min pro et ~160 mots/min patient avec pauses moyennes 1 s, estimation : **Durand ~6 min 30 / Martin ~4 min 40 / Lefèvre ~3 min 50**. On peut allonger/raccourcir en ajoutant/retirant des tours autour du point-clé si les durées cible doivent être tenues au mot près.
