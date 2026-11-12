/* Bibliothèque d'exercices (français).
   Préfixe ~ = exercice chronométré en secondes, ^ = en minutes. */
const RAW = {
  'Pectoraux': {
    'Barre': `Développé couché|Développé incliné|Développé décliné|Développé couché prise large|Développé couché avec pause|Pull-over barre EZ`,
    'Haltères': `Développé couché haltères|Développé incliné haltères|Développé décliné haltères|Développé haltères prise neutre|Écarté couché haltères|Écarté incliné haltères|Pull-over haltère|Squeeze press haltères|Développé au sol haltères`,
    'Machine': `Chest press|Chest press incliné|Chest press décliné|Chest press unilatéral|Pec deck (papillon)|Développé couché Smith|Développé incliné Smith|Développé décliné Smith`,
    'Poulie': `Écarté poulie vis-à-vis|Écarté poulie basse|Écarté poulie haute|Écarté poulie un bras|Développé poulie debout|Développé couché poulie`,
    'Poids du corps': `Pompes|Pompes inclinées|Pompes déclinées|Pompes lestées|Pompes mains larges|Pompes sur les poings|Pompes archer|Dips pectoraux`,
    'Élastique': `Pompes avec élastique|Écarté élastique|Développé élastique debout`
  },
  'Dos': {
    'Barre': `Soulevé de terre|Soulevé de terre trap bar|Rowing barre|Rowing Yates|Rowing Pendlay|Rowing T-bar|Rowing barre prise supination|Meadows row`,
    'Haltères': `Rowing haltère un bras|Rowing haltère penché|Rowing haltères poitrine appuyée|Rowing haltères prise neutre|Rowing Kroc`,
    'Machine': `Tirage vertical|Tirage vertical prise serrée|Tirage vertical prise neutre|Tirage vertical unilatéral|Tirage horizontal assis|Rowing machine|Rowing machine poitrine appuyée|Rowing machine unilatéral|Low row machine|Pull-over machine|Rowing Smith|Tractions assistées machine`,
    'Poulie': `Tirage poitrine|Tirage nuque|Tirage horizontal poulie|Tirage horizontal prise neutre|Tirage bras tendus (pull-over poulie)|Rowing poulie un bras|Tirage poulie haute un bras`,
    'Poids du corps': `Tractions pronation|Tractions supination (chin-up)|Tractions prise neutre|Tractions larges|Tractions lestées|Tractions australiennes|Rowing inversé`,
    'Élastique': `Tirage élastique|Rowing élastique|Tractions assistées élastique|Pull-over élastique`
  },
  'Épaules': {
    'Barre': `Développé militaire|Développé militaire assis|Push press|Tirage menton|Développé nuque|Landmine press`,
    'Haltères': `Développé épaules haltères|Développé haltères assis|Développé Arnold|Élévations latérales|Élévations latérales unilatérales|Élévations frontales|Oiseau penché|Élévations latérales penché|Y-raise haltères`,
    'Machine': `Shoulder press|Shoulder press unilatéral|Élévations latérales machine|Oiseau machine (reverse pec deck)|Développé épaules Smith`,
    'Poulie': `Face pull|Élévations latérales poulie|Élévations frontales poulie|Oiseau poulie|Tirage menton poulie|Développé épaule poulie`,
    'Poids du corps': `Pompes pike|Pompes pike pieds surélevés|~Équilibre sur les mains (handstand)`,
    'Kettlebell': `Développé kettlebell|Développé kettlebell bottom-up|Halo kettlebell`,
    'Élastique': `Élévations latérales élastique|Face pull élastique|Écartement élastique (band pull-apart)|Développé épaules élastique`
  },
  'Trapèzes': {
    'Barre': `Shrugs barre|Shrugs barre derrière|Rack pull`,
    'Haltères': `Shrugs haltères|Shrugs incliné haltères`,
    'Machine': `Shrugs machine|Shrugs Smith`,
    'Poulie': `Shrugs poulie`,
    'Poids du corps': `Rétraction scapulaire suspendue`
  },
  'Biceps': {
    'Barre': `Curl barre droite|Curl barre EZ|Curl barre EZ prise serrée|Curl barre prise large|Curl pupitre barre EZ|Curl 21`,
    'Haltères': `Curl haltères alterné|Curl haltères simultané|Curl marteau|Curl marteau croisé|Curl incliné|Curl concentré|Curl pupitre haltère|Curl Zottman|Curl Spider haltères`,
    'Machine': `Curl machine|Curl pupitre machine|Curl biceps unilatéral machine`,
    'Poulie': `Curl poulie basse|Curl poulie haute|Curl poulie corde (marteau)|Curl poulie un bras|Curl poulie barre EZ|Curl Spider poulie`,
    'Poids du corps': `Curl biceps aux anneaux`,
    'Kettlebell': `Curl kettlebell`,
    'Élastique': `Curl élastique|Curl marteau élastique`
  },
  'Triceps': {
    'Barre': `Barre au front (skull crusher)|Barre au front incliné|Développé couché prise serrée|Extension nuque barre EZ|JM press`,
    'Haltères': `Extension haltère nuque|Extension haltère un bras|Extension haltères couché|Barre au front haltères|Kick-back haltère`,
    'Machine': `Extension triceps machine|Dips machine|Développé triceps Smith`,
    'Poulie': `Extension poulie haute corde|Extension poulie haute barre droite|Extension poulie haute barre V|Extension poulie un bras|Extension poulie nuque|Extension poulie inversée (supination)|Kick-back poulie`,
    'Poids du corps': `Dips triceps|Dips lestés|Dips sur banc|Pompes diamant|Extension triceps au sol`,
    'Élastique': `Extension triceps élastique|Kick-back élastique`
  },
  'Avant-bras': {
    'Barre': `Curl poignets barre|Curl poignets inversé barre|Curl inversé barre`,
    'Haltères': `Curl poignets haltères|Curl poignets inversé haltères|Rotation poignets haltère`,
    'Poulie': `Curl poignets poulie`,
    'Poids du corps': `~Suspension à la barre (dead hang)`,
    'Autre': `Rouleau avant-bras (wrist roller)|Gripper`
  },
  'Quadriceps': {
    'Barre': `Squat|Squat avant|Squat pause|Squat zercher|Squat box|Squat bulgare barre|Fentes barre|Fentes marchées barre|Fentes arrière barre|Hack squat barre`,
    'Haltères': `Squat gobelet haltère|Squat haltères|Fentes haltères|Fentes marchées haltères|Fentes arrière haltères|Squat bulgare haltères|Step-up haltères|Fente latérale haltères`,
    'Machine': `Presse à cuisses|Presse à cuisses inclinée 45°|Presse horizontale|Hack squat machine|Leg extension|Leg extension unilatéral|Squat Smith|Fentes Smith|Squat bulgare Smith|Pendulum squat|Belt squat|V-squat`,
    'Poids du corps': `Squat poids du corps|Fentes poids du corps|Fentes marchées poids du corps|Fentes sautées|Squat sauté|Pistol squat|Squat bulgare poids du corps|Step-up|~Chaise (wall sit)`,
    'Kettlebell': `Squat goblet kettlebell|Squat kettlebell avant (front rack)|Fente kettlebell`,
    'Élastique': `Squat élastique|Leg extension élastique`
  },
  'Ischio-jambiers': {
    'Barre': `Soulevé de terre roumain|Soulevé de terre jambes tendues|Good morning`,
    'Haltères': `Soulevé de terre roumain haltères|Soulevé de terre jambes tendues haltères|Soulevé de terre unilatéral haltère|Leg curl haltère`,
    'Machine': `Leg curl allongé|Leg curl assis|Leg curl debout|Leg curl unilatéral|Glute-ham raise`,
    'Poulie': `Leg curl poulie|Tirage poulie jambes tendues`,
    'Poids du corps': `Nordic curl|Leg curl sur sliders|Leg curl swiss ball|Pont ischios talons surélevés`,
    'Kettlebell': `Soulevé de terre kettlebell|Soulevé de terre roumain kettlebell`,
    'Élastique': `Leg curl élastique`
  },
  'Fessiers': {
    'Barre': `Hip thrust barre|Hip thrust unilatéral barre|Pont fessier barre|Soulevé de terre sumo`,
    'Haltères': `Hip thrust haltère|Pont fessier haltère|Pont fessier unilatéral haltère|Step-up haut haltères|Squat sumo haltère`,
    'Machine': `Hip thrust machine|Hip thrust Smith|Abduction machine|Kickback machine|Presse pieds hauts|Extension de hanche machine|Glute drive`,
    'Poulie': `Kickback poulie|Abduction poulie|Pull-through poulie|Extension de hanche poulie`,
    'Poids du corps': `Pont fessier|Pont fessier unilatéral|Hip thrust poids du corps|Donkey kick|Fire hydrant|Clam shell|Abduction allongé sur le côté|Fentes arrière poids du corps`,
    'Kettlebell': `Swing kettlebell|Hip thrust kettlebell`,
    'Élastique': `Pont fessier élastique|Hip thrust élastique|Marche latérale élastique|Abduction élastique|Donkey kick élastique|Clam shell élastique`
  },
  'Adducteurs': {
    'Haltères': `Squat sumo goblet haltère`,
    'Machine': `Adduction machine`,
    'Poulie': `Adduction poulie`,
    'Poids du corps': `Adduction au sol|Squat sumo poids du corps|Fente latérale poids du corps|~Copenhagen plank`,
    'Élastique': `Adduction élastique`
  },
  'Mollets': {
    'Barre': `Mollets debout barre|Mollets assis barre`,
    'Haltères': `Mollets haltères debout|Mollets haltère un pied|Mollets assis haltères`,
    'Machine': `Mollets debout machine|Mollets assis machine|Mollets à la presse|Mollets Smith|Donkey calf raise`,
    'Poids du corps': `Mollets debout|Mollets sur marche|Mollets unilatéral`,
    'Kettlebell': `Mollets kettlebell`,
    'Élastique': `Mollets élastique`
  },
  'Abdominaux': {
    'Poids du corps': `Crunch|Crunch inversé|Crunch oblique|Sit-up|Relevé de buste|Relevé de jambes allongé|Relevé de jambes suspendu|Relevé de genoux suspendu|Toes to bar|~Gainage (planche)|~Gainage latéral|Gainage dynamique|Planche avec toucher d'épaule|Mountain climbers|Russian twist|Bicyclette|Roue abdominale (ab wheel)|~Hollow body|Dead bug|V-ups|~L-sit`,
    'Machine': `Crunch machine|Crunch banc incliné|Rotation machine|Relevé de jambes chaise romaine`,
    'Poulie': `Crunch poulie (cable crunch)|Crunch poulie oblique|Rotation poulie|Woodchop poulie haut-bas|Woodchop poulie bas-haut|Pallof press`,
    'Haltères': `Russian twist lesté|Flexion latérale haltère|Crunch lesté|Sit-up lesté`,
    'Barre': `Rollout barre|Landmine twist`,
    'Kettlebell': `Flexion latérale kettlebell|Russian twist kettlebell`,
    'Élastique': `Pallof press élastique|Crunch élastique`
  },
  'Lombaires': {
    'Poids du corps': `Superman|Extension lombaires au sol|Bird dog`,
    'Machine': `Hyperextension 45°|Hyperextension à plat|Machine lombaires`,
    'Barre': `Good morning assis`,
    'Haltères': `Hyperextension lestée haltère`
  },
  'Corps entier': {
    'Barre': `Épaulé-jeté (clean and jerk)|Épaulé (power clean)|Épaulé suspendu (hang clean)|Arraché (snatch)|Arraché de puissance|Thruster barre`,
    'Haltères': `Thruster haltères|Man maker|Épaulé-jeté haltère|Épaulé haltère|Arraché haltère un bras|~Farmer's walk`,
    'Kettlebell': `Turkish get-up|Clean kettlebell|Clean & press kettlebell|Arraché kettlebell (snatch)|Thruster kettlebell|Swing kettlebell américain`,
    'Poids du corps': `Burpees|Jumping jacks|Squat thrust|Bear crawl|Planche to push-up|Saut sur box (box jump)|Burpee box jump`,
    'Autre': `~Battle rope|Traîneau poussé (sled push)|Traîneau tracté (sled pull)|Retournement de pneu|Slam ball|Wall ball|Sac de sable (sandbag carry)`
  },
  'Cardio': {
    'Machine': `^Tapis de course|^Marche inclinée|^Vélo stationnaire|^Vélo semi-allongé|^Elliptique|^Rameur|^Stepper|^Escaliers (stairmaster)|^Assault bike|^SkiErg`,
    'Poids du corps': `^Course à pied|^Corde à sauter|^Marche|^Sprints`,
    'Autre': `^Natation|^Vélo (extérieur)|^Randonnée|^Boxe (sac)`
  }
};

export const MUSCLES = Object.keys(RAW);
export const EQUIPS = ['Barre', 'Haltères', 'Machine', 'Poulie', 'Kettlebell', 'Élastique', 'Poids du corps', 'Autre'];

const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const LIB = [];
const seen = new Set();
for (const [muscle, eqs] of Object.entries(RAW)) {
  for (const [equip, list] of Object.entries(eqs)) {
    for (let name of list.split('|')) {
      let unit = '';
      if (name[0] === '~') { unit = 's'; name = name.slice(1); }
      else if (name[0] === '^') { unit = 'min'; name = name.slice(1); }
      const id = 'x-' + slug(muscle) + '-' + slug(equip) + '-' + slug(name);
      if (seen.has(id)) continue;
      seen.add(id);
      LIB.push({ id, name, muscle, equip, unit, custom: false, _n: norm(name + ' ' + muscle + ' ' + equip) });
    }
  }
}
