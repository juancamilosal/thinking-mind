// Datos de la página, tomados de thinkingmind.co.
// Los programas van en el orden en que aparecen en el carrusel principal de la página actual
// (los más vistos primero) y luego el resto.

const INCLUYE_VIAJE = [
  ['cama', 'Hospedaje', 'Hospedaje en campus estudiantil. Estadía en hoteles o campus durante las excursiones en las diferentes ciudades.'],
  ['plato', 'Alimentación', 'Desayuno, almuerzo y cena en el campus. Tendrán comidas completas en los hoteles y en diversos restaurantes durante las excursiones.'],
  ['libro', 'Competencia académica', 'Clases y actividades en inglés con profesores y personal nativo y certificado. Los estudiantes estarán en clases según su edad y nivel.'],
  ['avion', 'Tiquetes aéreos', 'Trámites y proceso de compra de tiquetes aéreos ida y vuelta a través de nuestra agencia de viajes no IATA para mayor seguridad.'],
  ['pasaporte', 'Trámites de visa', 'Acompañamiento y asesoría durante todo el proceso de solicitud de visa a los países que la requieran: Reino Unido. Desde formularios hasta la entrega final.'],
  ['bus', 'Traslados', 'Transporte desde y hasta el aeropuerto, los hoteles, el campus y las excursiones. En las diferentes ciudades tendrán cubiertos todos los desplazamientos.'],
  ['mapa', 'Excursiones', 'Entrada a atracciones turísticas, tours guiados y tiempo para conocer en múltiples pueblos y ciudades en 2 países diferentes.'],
  ['escudo', 'Seguro médico internacional', 'Cobertura médica completa en caso de alguna eventualidad. En el campus hay personal médico entrenado y disponible 24/7 para atender cualquier necesidad.'],
  ['morral', 'Kit de viaje', 'Los estudiantes recibirán un morral, un esfero, actividades, bloqueador solar y demás elementos para complementar su viaje.']
];
const INCLUYE_ONLINE = [
  ['libro', 'Programa académico', 'Clases y talleres con profesores nativos, orientados al fortalecimiento del inglés y francés.'],
  ['juego', 'Juegos y actividades', 'Actividades, juegos, competencias, desarrollo del carácter, habilidades de vida y más.'],
  ['diploma', 'Certificado de participación', 'Recibirás un certificado al culminar el programa.'],
  ['morral', 'Material de trabajo', 'Kit E-Summer. No aplica para AYO.']
];

const CATEGORIAS = {
  viajes: { nombre: 'Viajes internacionales', clase: 'azul' },
  colombia: { nombre: 'En Colombia', clase: 'verde' },
  online: { nombre: 'Online', clase: 'naranja' }
};

const PROGRAMAS = [
  {
    id: 'summer-camp', nombre: 'Summer Camp', cat: 'viajes', precio: 37000000, popular: true,
    lema: 'See it, live it & boosted',
    resumen: 'La mejor manera de pasar tus vacaciones de verano: viajando, conociendo nuevos países y culturas, aprendiendo inglés en Inglaterra y haciendo nuevos amigos de todo el mundo.',
    texto: [
      'El Summer Camp es la forma más creativa y divertida de pasar el verano. Todos los días siempre hay algo nuevo que hacer o descubrir. El aprendizaje se da conociendo nuevos países, culturas y personas.',
      'Esta experiencia te abrirá los ojos al mundo, te motivará a seguir adquiriendo idiomas y te ayudará a mejorar tus habilidades y confianza en el inglés.',
      'Fortalece los idiomas con docentes nativos de varios países en los cinco continentes, certificados y capacitados junto a nuestros Activity Leaders experimentados.'
    ],
    datos: [['Campus', 'Oundle / Rugby / York / Uppingham'], ['Clases', 'Inglés, francés y más'], ['Dirigido a', 'Estudiantes de 7 a 18 años'], ['Duración', '2 a 3 semanas según elección'], ['Destinos', 'Inglaterra, Francia, Zambia, Canadá, Sudáfrica, USA y Colombia']],
    nota: 'Ceremonia y certificado de grado al culminar el programa.',
    destacados: ['Inglés', 'Francés', 'Fotografía', 'Edición de video', 'Comunicación asertiva', 'Competencias', 'Resolución de conflictos', 'Disco y más'],
    incluye: INCLUYE_VIAJE, fotos: 5, banner: 'summer-camp', video: 'LJ4C-EHf1XI'
  },
  {
    id: 'winter-camp', nombre: 'Winter Camp', cat: 'viajes', precio: 32000000, popular: true,
    lema: 'Learning languages with Santa',
    resumen: 'Una experiencia única que combina diversión, aprendizaje y aventura. No solo aprenderás un nuevo idioma, ¡lo vivirás!',
    texto: [
      'El Winter Camp es una experiencia única que combina diversión, aprendizaje y aventura. Todos los días siempre hay algo nuevo que hacer o descubrir.',
      'La temporada de invierno trae consigo hermosas vistas que no se dan en el resto del año. El clima del verano puede ser muy atractivo, pero en invierno Europa tiene un ambiente mucho más encantador. Es una experiencia de viaje completamente diferente.',
      'Es un programa académico de inmersión en inglés y/o francés intensivo, con días llenos de clases y actividades en un campus escolar, junto con extraordinarias excursiones para complementar la experiencia.'
    ],
    datos: [['Campus', 'Oundle / Rugby / York / Uppingham'], ['Clases', 'Inglés, francés y más'], ['Dirigido a', 'Estudiantes de 8 a 18 años'], ['Duración', '2 semanas'], ['Niveles', 'Todos, de principiante a avanzado (A1–C2)']],
    nota: 'Ceremonia y certificado de grado al culminar el programa.',
    destacados: ['Inglés conversacional', 'Francés conversacional', 'Pinturas navideñas', 'Juegos de mesa', 'Disco-Time', 'Photo Challenge', 'Visita de Santa Claus'],
    incluye: INCLUYE_VIAJE, fotos: 8, banner: 'winter-camp', video: 'gqr4KyzgcAw'
  },
  {
    id: 'will-go', nombre: 'Will Go!', cat: 'colombia', precio: 600000, popular: true,
    lema: 'Weekend Immersion in Language and Leisure',
    resumen: 'Fin de semana de inmersión en idiomas y recreación, con clases, debates, actividades, deportes y juegos.',
    texto: [
      'El programa Will-Go! está diseñado para que nuestros estudiantes tengan una experiencia de aprendizaje significativa como un refuerzo a sus estudios del idioma. Con un programa académico completo y actividades desafiantes, el inglés será algo novedoso y divertido.',
      'Tendrás la oportunidad de tener clases de inglés con múltiples profesores nativos y certificados en la enseñanza del idioma, todos provenientes de diferentes países del mundo.',
      'Desde juegos al aire libre hasta Arts & Crafts y concursos de creatividad, las actividades del Will-Go! son una forma divertida de poner a prueba el idioma. Estarán acompañados de los Activity Leaders, quienes desarrollan todo el programa en inglés.'
    ],
    datos: [['Formato', 'Fin de semana de inmersión'], ['Clases', 'Inglés y francés'], ['Dirigido a', 'Colegios'], ['Profesores', 'Nativos y certificados']],
    nota: '¡Es una experiencia lingüística y multicultural!',
    destacados: ['English', 'Lessons', 'Activities', 'Games', 'Fun'],
    incluye: [
      ['plato', 'Alimentación', 'Desayuno, almuerzo y cena durante el programa.'],
      ['juego', 'Juegos y actividades', 'Juegos, competencias, desafíos, desarrollo del ser, desarrollo del carácter y habilidades de vida con nuestros Activity Leaders, todo en inglés.'],
      ['diploma', 'Certificado de participación', 'Recibirás un certificado al culminar el programa.'],
      ['morral', 'Material de trabajo', 'E-Student Card y E-Summer Kit.']
    ],
    fotos: 6, banner: 'will-go', video: 'bSiuXfM16cw'
  },
  {
    id: 'ace-programme', nombre: 'ACE Programme', cat: 'viajes', precio: 26800000, popular: true,
    lema: 'Ability in learning, Competitive spirit and Energy to succeed',
    resumen: 'Competencia lingüística internacional. Prepárate, representa y gana en esta emocionante competencia lingüística y cultural.',
    texto: [
      'Con actividades, talleres, debates y excursiones, el ACE Programme te dará las habilidades y la experiencia para afrontar nuevos retos en inglés. Consiste en 3 módulos de competencias; cada módulo dura entre 3 y 4 días.',
      'Es una experiencia en la que se pone en juego la capacidad del estudiante de defenderse en un ambiente en donde el único idioma posible para comunicarse será el inglés.',
      'Durante la competencia hay visitas guiadas a lugares del Reino Unido como el London Eye, The Making of Harry Potter Warner Bros Studios, Cambridge y Oxford. Al finalizar, los estudiantes viajan unos días a París, Francia.'
    ],
    datos: [['Campus', 'Rugby'], ['Clases', 'Inglés (nivel mínimo A2 a C2)'], ['Dirigido a', 'Estudiantes de 8 a 18 años'], ['Duración', '2 semanas'], ['Destinos', 'Inglaterra y Francia']],
    nota: 'Al final del programa se lleva a cabo la premiación. El mejor grupo, además del premio, recibe un certificado de excelencia.',
    destacados: ['Drama', 'Debate', 'Negocio'],
    incluye: [INCLUYE_VIAJE[0], INCLUYE_VIAJE[1], ['libro', 'Competencia académica', 'Talleres y clases guiadas para preparar sus presentaciones en los diferentes módulos de la competencia. Los estudiantes se organizarán por grupos para competir.'], ...INCLUYE_VIAJE.slice(3)],
    fotos: 5, banner: 'ace-programme', video: 'm9oN8eHCN-I'
  },
  {
    id: 'grow-camp', nombre: 'Grow Camp', cat: 'colombia', precio: 4500000, popular: true,
    lema: 'Let me grow!',
    resumen: 'Tu primer campamento en Colombia. Creces en idiomas y como persona, en un campus fuera de la ciudad con actividades al aire libre y excursiones.',
    texto: [
      'Si eres de los padres que creen que los hijos deben resolver sus tareas solos, lavar platos, saber cocinar, ser autónomos, ser independientes, saber hacer amigos, hacer deportes, practicar los idiomas y tener una experiencia concreta antes de salir del país, Grow Camp es para ti.',
      '14 horas diarias de inmersión lingüística en Colombia. Grow es el espacio perfecto para que nuestros hijos crezcan en idiomas y como seres humanos.',
      'Pop Art House es un campus con concepto de arte pop y una extensa zona verde para fogatas y actividades de integración. Wellness House es un campus tranquilo, alejado de la ciudad, con 20.000 metros de zona verde.'
    ],
    datos: [['Campus', 'Pop Art House y Wellness House'], ['Clases', 'Inglés y francés'], ['Dirigido a', 'Estudiantes de 8 a 17 años'], ['Duración', '6 días y 5 noches'], ['Destino', 'Colombia']],
    nota: 'Tu primer campamento de verano en inglés.',
    destacados: ['Autonomía', 'Hacer amigos', 'Deportes', 'Amar la lectura', 'Dejar la timidez', 'Desconectarse de las redes', 'Practicar idiomas'],
    incluye: [INCLUYE_VIAJE[0], INCLUYE_VIAJE[1], ['libro', 'Programa académico', 'Talleres y clases guiadas en inglés y francés con docentes nativos.'], INCLUYE_VIAJE[6], INCLUYE_VIAJE[7], INCLUYE_VIAJE[5], INCLUYE_VIAJE[8]],
    fotos: 8, banner: 'grow-camp', video: 'Syg-jcSWOgo'
  },
  {
    id: 'ayo-weekend', nombre: 'AYO Weekend', cat: 'online', precio: 250000, popular: true,
    lema: 'It’s time to practice',
    resumen: 'Inmersión lingüística en inglés y francés durante un fin de semana, con docentes nativos y activity leaders que te harán vivir una experiencia única.',
    texto: [
      'AYO es una palabra de origen africano que significa “¡Asombroso, lo logramos!”. Es un programa para practicar los idiomas con talento humano Thinking Mind y no con una máquina, rompiendo paradigmas de las clases tradicionales.',
      'Inmersión lingüística en idiomas durante los fines de semana: la forma más práctica de propender por el bilingüismo y el trilingüismo. Ser bilingüe requiere práctica constante.',
      'La sesión AYO es divertida y disruptiva: aprendes el hablado nativo (Voice), la interacción lleva el 80 % de la sesión, tienes actividades, juegas y finalizas tu sesión con un Wrap-up único.'
    ],
    datos: [['Modalidad', 'Virtual y presencial'], ['Clases', 'Inglés y francés'], ['Dirigido a', 'Niños de 6 a 17 años'], ['Intensidad', 'Virtual: 12 horas · Presencial: 4 horas cada fin de semana'], ['Disponibilidad', 'Abierto todo el año']],
    nota: '¡Ahora es tu tiempo de hablar!',
    destacados: ['Language', 'Interaction', 'Voice', 'Activity', 'Game', 'Wrap-up'],
    incluye: INCLUYE_ONLINE.slice(0, 3), fotos: 2, banner: 'ayo', video: 'NNnBB9iqZIU'
  },
  {
    id: 'ayo-conversational-club', nombre: 'AYO Conversational Club', cat: 'online', precio: 300000,
    lema: '¡AYO, it’s time to practice!',
    resumen: 'Clases conversacionales de inglés y francés desde casa con ATF (AYO Talkative Friends) nativos y amigos de otras partes del mundo.',
    texto: [
      'En AYO Club practicas los idiomas inglés o francés dos días a la semana con docentes nativos (ATF, AYO Talkative Friends) y juegas con activity leaders. Los juegos son en el idioma de aprendizaje.',
      'Nuestros ATF tienen una metodología disruptiva que da un lugar de predilección a la interacción: promueven un tiempo de habla del estudiante del 80 %. El protagonista eres tú.',
      'Es estratégico para las instituciones educativas que buscan el bilingüismo o el trilingüismo: un plus sólido para el departamento de idiomas. Después del colegio, AYO es el rincón perfecto del bilingüismo.'
    ],
    datos: [['Modalidad', 'Virtual, desde casa'], ['Clases', 'Inglés y francés'], ['Dirigido a', 'Niños y adultos'], ['Frecuencia', 'Dos días a la semana'], ['Sesiones', '40 minutos con ATF nativos']],
    nota: 'Aquí no solo estudias los idiomas: ¡los practicas!',
    destacados: ['Languages', 'Interactions', 'Voice', 'Activities', 'Games', 'Wrap-up'],
    incluye: INCLUYE_ONLINE.slice(0, 3), fotos: 1, video: 'NNnBB9iqZIU'
  },
  {
    id: 'e-summer-camp', nombre: 'E-Summer Camp', cat: 'online', precio: 599100,
    lema: 'Vacaciones sin alteraciones',
    resumen: 'Campamento de verano en línea de 2 o 3 semanas para reforzar idiomas, desarrollar habilidades de vida y conocer amigos mientras te diviertes.',
    texto: [
      'El campamento de verano en línea es la opción adecuada durante 2 o 3 semanas para reforzar idiomas, desarrollando habilidades de vida, pensamiento crítico y el carácter con creatividad, conociendo amigos mientras te diviertes.',
      'Todo el programa tiene lineamientos pedagógicos claros para que sea una experiencia de descanso y así vivas unas vacaciones sin alteraciones.',
      'Actividades, clases y juegos desde las 9 a. m. hasta las 11:40 a. m., y después de las 6 p. m. hasta las 6:40 p. m. con actividades nocturnas. Nuestro equipo está disponible 24/7.'
    ],
    datos: [['Modalidad', 'En línea'], ['Clases', 'Inglés y francés'], ['Dirigido a', 'Colegios'], ['Duración', '2 o 3 semanas'], ['Horario', '9:00–11:40 a. m. y 6:00–6:40 p. m.']],
    nota: 'Campamento en línea con equipo disponible 24/7.',
    destacados: ['English', 'French', 'Photography', 'Video edition', 'Competition', 'Kid’s board', 'Disco'],
    incluye: INCLUYE_ONLINE, fotos: 4, logo: 1
  },
  {
    id: 'e-winter-camp', nombre: 'E-Winter Camp', cat: 'online', precio: 599100,
    lema: 'Ho, ho, ho! Más allá de una pantalla',
    resumen: 'Campamento de invierno online: aprende inglés y francés con profesores nativos y activity leaders certificados en enseñanza lingüística.',
    texto: [
      'Campamento de invierno online para aprender inglés y francés con profesores nativos y activity leaders certificados en enseñanza lingüística.',
      'Desarrolla tus habilidades y vive la mejor experiencia en idiomas con amigos de diferentes partes del mundo.'
    ],
    datos: [['Modalidad', 'En línea'], ['Clases', 'Inglés y francés'], ['Dirigido a', 'Colegios'], ['Temporada', 'Noviembre y diciembre']],
    nota: 'Más allá de una pantalla.',
    destacados: ['Conversational English', 'Conversational French', 'Christmas', 'Games', 'Friends'],
    incluye: INCLUYE_ONLINE.slice(0, 3), fotos: 3
  },
  {
    id: 'talky', nombre: 'Talky', cat: 'online', precio: 292000,
    lema: 'Keep talking',
    resumen: 'El idioma como herramienta de vida para tu trabajo, tus estudios y tu proyecto personal. Programa para mayores de 18 años.',
    texto: [
      'Idioma como herramienta de vida (inglés o francés) para tu trabajo, tus estudios y tu proyecto personal de vida. Si cuentas con un tiempo escaso pero con objetivos claros, este programa es para ti.',
      'Tres componentes: Talky Class, tres veces a la semana con docentes nativos aplicando el lenguaje funcional; Talky Reading, un componente que surge de la experiencia propia de Thinking Mind; y Talky Forum, donde tus chats se hacen en el idioma de aprendizaje.',
      'Aprende el idioma en 5 niveles: Flower, Akasi, Giwa, Simba y Oni.'
    ],
    datos: [['Modalidad', 'En línea'], ['Clases', 'Inglés o francés'], ['Dirigido a', 'Mayores de 18 años'], ['Frecuencia', 'Tres veces a la semana'], ['Niveles', '5 niveles']],
    nota: 'Los tres componentes juntos crean los hábitos necesarios para hablar el idioma.',
    destacados: ['Talky Class', 'Talky Reading', 'Talky Forum'],
    incluye: INCLUYE_ONLINE.slice(0, 3), fotos: 2, logo: 1
  }
];

const COLEGIOS = ['1-1', '36', 'cch', '2', 'lauretta-bender-bilingual-school', '29', 'ciudad-educadora', 'colegio-angloamericano-1', 'colegio-colombo-gales', '22', '23', '4', '13', '8', '16', 'colegio-nueva-york', '7', 'fundacion-colegio-uis', 'colegio-andino-deutsche-schule', 'colegio-san-bonifacio', '31', 'colegio-bilingue-hispanoamericano', 'liceo-panamericano', 'ccr', '21', '38', 'colegio-mayor-de-los-andes', '30', 'gimnasio-los-roble', '11', '5', 'ss-1', 'gimnasio-campestre', 'colegio-himalaya', 'paideia-school-corporacion-1', '33', '27', '19', 'jardin-infantil-stanford', 'george-s-noble', 'roar-1', 'montemayor-school', '20', 'colegio-jose', 'gimnasio-altair', '9', '6', 'minuto-de-dios', 'fem', '32', 'gimnasio-domingo-savio', '25', '17', 'escudosgs-v1', '15', '26', 'divino-salvador-school', '34', 'colegio-cumbres', 'gimnasio-altair-de-la-sabana', 'gimnasio-campestre-los-cerezos', '39', 'gimnasio-campestre-la-fontana', 'colegio-charles-de-gaulle', '3', '14', 'liceo-monteria', 'escuela-taller-sophia', '28', '37', '35', '18', '10', 'gimnasio-los-andes'];
