// Schéma d'une fiche. Si un champ obligatoire manque ou est mal formé,
// « npm run build » échoue avec un message qui indique le fichier fautif.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import types from './data/types.json';

const TYPES = types.map((t) => t.id) as [string, ...string[]];

const oeuvres = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/oeuvres' }),
  schema: z.object({
    date: z.coerce.date(), // date de publication (AAAA-MM-JJ)
    type: z.enum(TYPES),
    titre: z.string(),
    titre_original: z.string().optional(),
    createur: z.string().optional(), // absent pour une idée sans auteur unique
    epoque: z.string(), // année ou période, ex. « 1865 » ou « vers 170-180 »
    accroche: z.string(), // une phrase, affichée en tête et dans les archives
    question: z.string(),
    ressource: z.object({
      libelle: z.string(), // ex. « Lire le texte intégral sur Wikisource »
      url: z.string().url(),
      note: z.string().optional(), // ex. traduction, durée, langue
    }),
    plus_loin: z
      .array(
        z.object({
          titre: z.string(),
          type: z.string(), // un type de Curiosa (livre, tableau…) ou un autre mot (sculpture, lieu…)
          createur: z.string().optional(),
          pourquoi: z.string(),
          url: z.string().url(),
        }),
      )
      .min(1)
      .max(3),
    image: z
      .object({
        url: z.string().url(), // fichier d'origine, téléchargé par « npm run images »
        alt: z.string(),
        credit: z.string(),
        licence: z.enum(['domaine public', 'CC0']),
      })
      .optional(),
    sources: z.array(z.string().url()).min(1), // pages d'où viennent les faits
  }),
});

export const collections = { oeuvres };
