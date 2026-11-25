---
date: 2026-11-22
type: papier
titre: Attention Is All You Need
createur: Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser et Illia Polosukhin
epoque: "2017"
accroche: "Quinze pages publiées par des chercheurs de Google, qui ont fourni le moteur de presque toutes les intelligences artificielles qui écrivent aujourd'hui."
question: "Comprendre une phrase, est-ce seulement savoir quels mots regarder ensemble ?"
ressource:
  libelle: Lire l'article sur arXiv
  url: https://arxiv.org/abs/1706.03762
  note: "En anglais. La page donne accès au PDF et à une version HTML lisible sur téléphone."
plus_loin:
  - titre: Plongement lexical
    type: idee
    createur: "D'après les linguistes Zellig Harris et John R. Firth"
    pourquoi: "Un pont vers la linguistique. L'idée qu'un mot se définit par les mots qui l'entourent, formulée dans les années 1950, est au cœur de la façon dont ces modèles représentent le sens."
    url: https://fr.wikipedia.org/wiki/Plongement_lexical
  - titre: Test de Turing
    type: idee
    createur: Alan Turing, 1950
    pourquoi: "La question que l'article de 2017 a rendue brûlante : à quoi reconnaîtrait-on qu'une machine pense ?"
    url: https://fr.wikipedia.org/wiki/Test_de_Turing
sources:
  - https://fr.wikipedia.org/wiki/Transformeur
  - https://arxiv.org/abs/1706.03762
---

## En quoi ça consiste

Un article de recherche en informatique, déposé sur arXiv le 12 juin 2017 par huit chercheurs alors chez Google. Il présente une nouvelle architecture de réseau de neurones, baptisée **Transformer** (en français, *transformeur*), conçue au départ pour la traduction automatique.

Jusque-là, les meilleurs systèmes lisaient une phrase mot après mot, dans l'ordre, en gardant une sorte de mémoire de ce qui précède. Le transformeur abandonne cette lecture séquentielle. Il repose entièrement sur un mécanisme dit d'**attention** : pour chaque mot, le modèle calcule à quel point chacun des autres mots de la phrase compte pour le comprendre, et il fait ce calcul pour tous les mots à la fois. Le titre résume le pari : l'attention suffit.

## Ce que ça apporte

Une idée simple à saisir, et qui éclaire beaucoup de choses. Le sens d'un mot dépend de ses voisins : dans « la souris a mangé le fromage » et « la souris de l'ordinateur », le même mot change de sens selon ce qui l'entoure. L'attention est une façon mécanique, mesurable, de tenir compte de ce contexte.

Lire cet article, même en diagonale, permet de comprendre ce qu'il y a sous le capot des assistants conversationnels actuels, sans mystère ni magie : des calculs de pondération entre mots, répétés sur de nombreuses couches, et entraînés sur d'immenses quantités de texte.

## Ce que ça a changé

Les auteurs montraient que leur modèle traduisait mieux que les meilleurs systèmes de l'époque, tout en étant plus facile à paralléliser et nettement plus rapide à entraîner. C'est ce dernier point qui a tout changé : on a pu entraîner des modèles beaucoup plus grands, sur beaucoup plus de données.

Le transformeur est devenu la base des grands modèles de langage, dont les GPT, qui n'en reprennent que la partie « décodeur ». L'architecture s'est ensuite étendue à l'image, au son, à la biologie. Peu d'articles scientifiques récents ont eu des conséquences aussi visibles dans la vie quotidienne.

## Par où commencer

Lisez le résumé et l'introduction (une page et demie), puis regardez la **figure 1**, le schéma de l'architecture : deux colonnes de blocs empilés, l'une qui lit la phrase d'origine, l'autre qui écrit la traduction. Allez ensuite directement aux dernières pages de la version complète : des visualisations y montrent, trait par trait, quels mots d'une longue phrase anglaise le modèle relie entre eux. On saisit l'idée d'attention en un coup d'œil, sans aucune formule.
