// Typographie française : espaces insécables avant ; : ! ? et à l'intérieur des guillemets,
// apostrophes typographiques. Appliqué au texte affiché uniquement (jamais aux URL).
export function typoFr(texte = '') {
  return texte
    .replace(/'/g, '’')
    .replace(/ ([;!?»])/g, ' $1')
    .replace(/ :/g, ' :')
    .replace(/« /g, '« ');
}
