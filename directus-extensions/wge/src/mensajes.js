// Traducción de los mensajes de error de WILL-GO ECONOMY (es → en, fr).
// Los mensajes se siguen escribiendo en español en el código; al responder se traducen según el
// encabezado Accept-Language. Cada entrada es [español, inglés, francés]; en el texto español, $1, $2…
// marcan los valores que van dentro del mensaje (los ${...} del código) y se reinsertan tal cual.

export const IDIOMAS_APP = ['es', 'en', 'fr'];

/** Idioma de la petición según Accept-Language: el primero que sea en, fr o es; si no hay, 'es'. */
export function idiomaDe(req) {
	const encabezado = req?.headers?.['accept-language'];
	const texto = Array.isArray(encabezado) ? encabezado.join(',') : String(encabezado ?? '');
	const preferidos = texto.split(',')
		.map((parte, i) => {
			const [etiqueta, ...params] = parte.trim().toLowerCase().split(';');
			const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
			const peso = q ? Number(q.slice(2)) : 1;
			return { idioma: etiqueta.split('-')[0].trim(), peso: Number.isFinite(peso) ? peso : 0, i };
		})
		.filter((p) => p.peso > 0 && IDIOMAS_APP.includes(p.idioma))
		.sort((a, b) => b.peso - a.peso || a.i - b.i);
	return preferidos[0]?.idioma ?? 'es';
}

const TRADUCCIONES = [
	// Generales y sesión
	['Error interno en Will Go Economy', 'Internal error in Will Go Economy', 'Erreur interne dans Will Go Economy'],
	['Debes iniciar sesión', 'You must sign in', 'Vous devez vous connecter'],
	// Cuentas, llaves y tarjeta débito
	['Escribe o escanea la llave', 'Type or scan the key', 'Saisissez ou scannez la clé'],
	['No hay ninguna cuenta con la llave $1', 'There is no account with the key $1', "Aucun compte n'a la clé $1"],
	['Elige los billetes que consigna el estudiante', 'Choose the bills the student is depositing', "Choisissez les billets que l'élève dépose"],
	['Elige los billetes que le entregas al estudiante', 'Choose the bills you give the student', "Choisissez les billets que vous remettez à l'élève"],
	['En su cuenta solo hay $1', 'Their account only has $1', "Son compte ne contient que $1"],
	['Una transferencia electrónica no lleva billetes', 'An electronic transfer has no bills', "Un virement électronique n'a pas de billets"],
	['Esa tarjeta es de $1 $2', 'That card belongs to $1 $2', 'Cette carte appartient à $1 $2'],
	['En la cuenta virtual del banco solo hay $1', "The bank's virtual account only has $1", 'Le compte virtuel de la banque ne contient que $1'],
	['Escribe el monto a cargar', 'Enter the amount to load', 'Saisissez le montant à charger'],
	['Escribe el monto', 'Enter the amount', 'Saisissez le montant'],
	['Escribe el dinero que tiene el banco', 'Enter the money the bank has', "Saisissez l'argent dont dispose la banque"],
	['Escribe el monto que consigna el estudiante', 'Enter the amount the student deposits', "Saisissez le montant que l'élève dépose"],
	['Escribe el monto que retira el estudiante', 'Enter the amount the student withdraws', "Saisissez le montant que l'élève retire"],
	['Escribe el monto que entregas al banco', 'Enter the amount you hand over to the bank', 'Saisissez le montant que vous remettez à la banque'],
	['Escribe el monto que invierte el estudiante', 'Enter the amount the student invests', "Saisissez le montant que l'élève investit"],
	['Escribe el monto que entra al banco', 'Enter the amount going into the bank', 'Saisissez le montant qui entre à la banque'],
	['Escribe con cuánto paga el estudiante', 'Enter how much the student pays with', "Saisissez avec combien l'élève paie"],
	['Escribe cuánto dinero contaste', 'Enter how much money you counted', "Saisissez combien d'argent vous avez compté"],
	['El monto es demasiado grande', 'The amount is too large', 'Le montant est trop élevé'],
	['Tu rol no puede hacer esta operación', 'Your role cannot perform this operation', 'Votre rôle ne permet pas cette opération'],
	['$1 debe ser un entero mayor que 0', '$1 must be a whole number greater than 0', '$1 doit être un entier supérieur à 0'],
	['Falta $1', 'Missing $1', 'Il manque $1'],
	['Falta el dueño de la billetera', 'The wallet owner is missing', 'Le propriétaire du portefeuille est manquant'],
	['La billetera no existe', 'The wallet does not exist', "Le portefeuille n'existe pas"],
	['Saldo insuficiente: hay $1', 'Insufficient balance: there is $1', 'Solde insuffisant : il y a $1'],
	['$1 no hace parte del equipo de esta edición', "$1 is not part of this edition's team", "$1 ne fait pas partie de l'équipe de cette édition"],
	['Tu usuario no hace parte del equipo de esta edición', "You are not part of this edition's team", "Vous ne faites pas partie de l'équipe de cette édition"],
	['El docente no hace parte del equipo de esta edición', "The teacher is not part of this edition's team", "L'enseignant ne fait pas partie de l'équipe de cette édition"],
	['Eres docente de $1; no maneja dinero de este país', 'You are a teacher for $1; you cannot handle money from this country', "Vous êtes enseignant pour $1 ; vous ne pouvez pas gérer l'argent de ce pays"],
	['Eres docente de otro país; no maneja dinero de este país', 'You are a teacher for another country; you cannot handle money from this country', "Vous êtes enseignant pour un autre pays ; vous ne pouvez pas gérer l'argent de ce pays"],
	['$1 es docente de $2; no maneja dinero de este país', '$1 is a teacher for $2; they cannot handle money from this country', "$1 est enseignant pour $2 ; il ne peut pas gérer l'argent de ce pays"],
	['El docente es docente de $1; no maneja dinero de este país', 'The teacher is assigned to $1; they cannot handle money from this country', "L'enseignant est affecté à $1 ; il ne peut pas gérer l'argent de ce pays"],
	['El banco de $1 lo maneja $2', "$1's bank is managed by $2", 'La banque de $1 est gérée par $2'],

	// Portal de acudientes
	['Tu sesión terminó; vuelve a entrar', 'Your session has ended; please sign in again', 'Votre session a expiré ; veuillez vous reconnecter'],
	['Escribe tu número de documento', 'Enter your ID number', "Saisissez votre numéro de pièce d'identité"],
	['Ya te enviamos varios códigos; espera unos minutos y revisa tu correo', 'We already sent you several codes; wait a few minutes and check your email', 'Nous vous avons déjà envoyé plusieurs codes ; patientez quelques minutes et consultez vos e-mails'],
	['El código no es correcto o ya venció', 'The code is incorrect or has expired', 'Le code est incorrect ou a expiré'],
	['Esta ronda ya cerró; podrás votar en la siguiente', 'This round has closed; you can vote in the next one', 'Cette manche est terminée ; vous pourrez voter à la suivante'],
	['No tienes estudiantes en esta edición', 'You have no students in this edition', "Vous n'avez aucun élève dans cette édition"],
	['La empresa no está disponible', 'The company is not available', "L'entreprise n'est pas disponible"],
	['Ya usaste tus $1 votos de esta ronda; quita uno para votar por otra empresa', 'You already used your $1 votes this round; remove one to vote for another company', 'Vous avez déjà utilisé vos $1 votes de cette manche ; retirez-en un pour voter pour une autre entreprise'],

	// Administración de ediciones
	['$1 debe ser un número entero de 0 en adelante', '$1 must be a whole number, 0 or greater', '$1 doit être un nombre entier supérieur ou égal à 0'],
	['$1 debe ser un número', '$1 must be a number', '$1 doit être un nombre'],
	['A qué se dedica: máximo 160 letras', 'What it does: 160 characters max', 'Activité : 160 caractères maximum'],
	['Por qué invertir: máximo 600 letras', 'Why invest: 600 characters max', 'Pourquoi investir : 600 caractères maximum'],
	['riesgo debe ser bajo, medio o alto', 'Risk must be low, medium or high', 'Le risque doit être faible, moyen ou élevé'],
	['Parámetros del tipo de cambio inválidos', 'Invalid exchange rate settings', 'Paramètres du taux de change invalides'],
	['El tipo de cambio se calcula cada $1 minutos', 'The exchange rate can be calculated every $1 minutes', 'Le taux de change peut être calculé toutes les $1 minutes'],
	['Falta el nombre', 'The name is missing', 'Le nom est manquant'],
	['El tope mínimo debe ser menor que el máximo', 'The minimum limit must be lower than the maximum', 'La limite minimale doit être inférieure à la maximale'],
	['El horario debe ser una lista', 'The schedule must be a list', "L'horaire doit être une liste"],
	['Cada franja del horario necesita hora de inicio y de fin (inicio antes que fin)', 'Each schedule slot needs a start and end time (start before end)', 'Chaque créneau horaire doit avoir une heure de début et de fin (début avant fin)'],
	['Fecha del horario inválida', 'Invalid schedule date', "Date d'horaire invalide"],
	['Cada franja necesita un día de la semana o una fecha', 'Each slot needs a weekday or a date', 'Chaque créneau doit avoir un jour de la semaine ou une date'],
	['La edición no existe', 'The edition does not exist', "L'édition n'existe pas"],
	['Elige el programa habilitado en el colegio (con su número de edición)', 'Choose the program enabled at the school (with its edition number)', "Choisissez le programme activé dans l'école (avec son numéro d'édition)"],
	['Ya existe la edición «$1» para ese colegio, programa y número de edición', 'The edition “$1” already exists for that school, program and edition number', "L'édition « $1 » existe déjà pour cette école, ce programme et ce numéro d'édition"],
	['La edición ya fue cerrada', 'The edition has already been closed', "L'édition a déjà été clôturée"],
	['La tasa inicial no se puede cambiar con la edición abierta', 'The initial exchange rate cannot be changed while the edition is open', "Le taux initial ne peut pas être modifié pendant que l'édition est ouverte"],
	['No se puede cambiar el programa: la edición ya tiene participantes', 'The program cannot be changed: the edition already has participants', "Impossible de changer le programme : l'édition a déjà des participants"],
	['El encargado de la caja debe ser un colaborador con rol Cajero', 'The checkout manager must be a staff member with the Cashier role', 'Le responsable de la caisse doit être un collaborateur avec le rôle Caissier'],
	['Esta edición ya tiene movimientos de dinero y no se puede eliminar, para no perder el historial', 'This edition already has money movements and cannot be deleted, so the history is kept', "Cette édition a déjà des mouvements d'argent et ne peut pas être supprimée, afin de garder l'historique"],
	['Los países se agregan antes de abrir la edición', 'Countries are added before opening the edition', "Les pays s'ajoutent avant d'ouvrir l'édition"],
	['Falta el precio', 'The price is missing', 'Le prix est manquant'],
	['No existe', 'Does not exist', "N'existe pas"],
	['La provisión del banco se define antes de abrir la edición', "The bank's supply is set before opening the edition", "La dotation de la banque se définit avant d'ouvrir l'édition"],
	['El responsable del banco debe ser un colaborador con rol Banco', 'The bank manager must be a staff member with the Bank role', 'Le responsable de la banque doit être un collaborateur avec le rôle Banque'],
	['No hay participantes seleccionados', 'No participants selected', 'Aucun participant sélectionné'],
	['Algún participante no existe', 'A participant does not exist', "Un des participants n'existe pas"],
	['Hay estudiantes retirados en la selección; reintégralos primero', 'The selection includes withdrawn students; reinstate them first', "La sélection contient des élèves retirés ; réintégrez-les d'abord"],
	['Los participantes deben ser de la misma edición', 'Participants must be from the same edition', 'Les participants doivent appartenir à la même édition'],
	['El país no es de esta edición', 'The country is not part of this edition', 'Le pays ne fait pas partie de cette édition'],
	['$1 $2 ya tiene dinero en su moneda actual; no se puede cambiar de país', '$1 $2 already has money in their current currency; the country cannot be changed', "$1 $2 a déjà de l'argent dans sa monnaie actuelle ; impossible de changer de pays"],
	['No hay cambios', 'No changes', 'Aucune modification'],
	['Escribe cuántos billetes entran al banco', 'Enter how many bills go into the bank', 'Indiquez combien de billets entrent à la banque'],
	['El país no existe', 'The country does not exist', "Le pays n'existe pas"],
	['Con la edición en preparación, edita el dinero del banco directamente', "While the edition is being prepared, edit the bank's money directly", "Tant que l'édition est en préparation, modifiez directement l'argent de la banque"],
	['No hay estudiantes seleccionados', 'No students selected', 'Aucun élève sélectionné'],
	['Algún estudiante no existe', 'A student does not exist', "Un des élèves n'existe pas"],
	['Los estudiantes deben ser de la misma edición', 'Students must be from the same edition', 'Les élèves doivent appartenir à la même édition'],
	['No hay colaboradores seleccionados', 'No staff members selected', 'Aucun collaborateur sélectionné'],
	['Algún usuario no es colaborador de Will Go', 'A user is not a Will Go staff member', "Un des utilisateurs n'est pas collaborateur de Will Go"],
	['No hace parte del equipo', 'Not part of the team', "Ne fait pas partie de l'équipe"],
	['El docente tiene dinero de otro país; primero debe entregarlo o devolverlo', 'The teacher has money from another country; they must hand it out or return it first', "L'enseignant a de l'argent d'un autre pays ; il doit d'abord le distribuer ou le rendre"],
	['Tiene $1 sin entregar en esta edición; primero debe entregarlo', 'They have $1 not yet handed out in this edition; they must hand it out first', "Il reste $1 non distribués dans cette édition ; il faut d'abord les distribuer"],
	['La foto debe ser JPG, PNG o WEBP', 'The photo must be JPG, PNG or WEBP', 'La photo doit être au format JPG, PNG ou WEBP'],
	['La foto debe pesar menos de 2 MB', 'The photo must be smaller than 2 MB', 'La photo doit peser moins de 2 Mo'],

	// Arqueo, banco y caja
	['Falta el conteo de billetes', 'The bill count is missing', 'Le comptage des billets est manquant'],
	['No existe el billete de $1', 'There is no $1 bill', "Le billet de $1 n'existe pas"],
	['La cantidad de billetes de $1 debe ser un entero de 0 en adelante', 'The number of $1 bills must be a whole number, 0 or greater', 'Le nombre de billets de $1 doit être un entier supérieur ou égal à 0'],
	['Elige el país', 'Choose the country', 'Choisissez le pays'],
	['La edición todavía no tiene encargado de la caja', 'The edition does not have a checkout manager yet', "L'édition n'a pas encore de responsable de caisse"],
	['La caja la maneja $1', 'The checkout is managed by $1', 'La caisse est gérée par $1'],
	['Elige los billetes que entregas al banco', 'Choose the bills you are handing to the bank', 'Choisissez les billets que vous remettez à la banque'],
	['En la caja solo hay $1 billetes de $2', 'The checkout only has $1 bills of $2', 'La caisse ne contient que $1 billets de $2'],
	['En la caja solo hay $1 billetes de $2 para el vuelto', 'The checkout only has $1 bills of $2 for change', 'La caisse ne contient que $1 billets de $2 pour la monnaie rendue'],
	['La edición todavía no se ha abierto', 'The edition has not been opened yet', "L'édition n'a pas encore été ouverte"],
	['Escribe CERRAR para confirmar', 'Type CERRAR to confirm', 'Tapez CERRAR pour confirmer'],

	// Transferencias y GO•STORE
	['La edición no está abierta', 'The edition is not open', "L'édition n'est pas ouverte"],
	['El participante no existe', 'The participant does not exist', "Le participant n'existe pas"],
	['El estudiante fue retirado de la edición', 'The student was withdrawn from the edition', "L'élève a été retiré de l'édition"],
	['El participante no tiene país asignado', 'The participant has no country assigned', "Le participant n'a pas de pays attribué"],
	['El destinatario no es docente de Will Go', 'The recipient is not a Will Go teacher', "Le destinataire n'est pas enseignant de Will Go"],
	['En el banco solo quedan $1 billetes de $2', 'The bank only has $1 bills of $2 left', 'Il ne reste que $1 billets de $2 à la banque'],
	['Solo tienes $1 billetes de $2', 'You only have $1 bills of $2', "Vous n'avez que $1 billets de $2"],
	['tipo debe ser banco_docente o docente_estudiante', 'tipo must be banco_docente or docente_estudiante', 'tipo doit être banco_docente ou docente_estudiante'],
	['La venta no tiene productos', 'The sale has no products', "La vente n'a aucun produit"],
	['Algún producto no existe', 'A product does not exist', "Un des produits n'existe pas"],
	['$1 no está disponible en esta edición', '$1 is not available in this edition', "$1 n'est pas disponible dans cette édition"],
	['No hay suficientes unidades de $1', 'Not enough units of $1', "Il n'y a pas assez d'unités de $1"],
	['Máximo $1 de $2 por estudiante', 'Maximum $1 of $2 per student', 'Maximum $1 de $2 par élève'],
	['El total es $1; el estudiante entregó $2', 'The total is $1; the student paid $2', "Le total est de $1 ; l'élève a remis $2"],
	['El vuelto debe ser $1 (marcaste $2)', 'The change must be $1 (you entered $2)', 'La monnaie rendue doit être de $1 (vous avez indiqué $2)'],
	['El estudiante solo tiene $1', 'The student only has $1', "L'élève n'a que $1"],
	['Elige los billetes que entrega el estudiante', 'Choose the bills the student is handing over', "Choisissez les billets que l'élève remet"],
	['La ronda no existe en esta edición', 'The round does not exist in this edition', "La manche n'existe pas dans cette édition"],
	['La ronda ya cerró; espera la siguiente', 'The round has closed; wait for the next one', 'La manche est terminée ; attendez la suivante'],
	['La ronda no existe', 'The round does not exist', "La manche n'existe pas"],
	['La ronda ya fue cerrada', 'The round has already been closed', 'La manche a déjà été clôturée'],
	['La edición no tiene programa asignado', 'The edition has no program assigned', "L'édition n'a pas de programme attribué"],
	['La edición no tiene países', 'The edition has no countries', "L'édition n'a aucun pays"],
	['No hay ningún estudiante con ese código', 'There is no student with that code', "Aucun élève n'a ce code"],

	// Colaboradores
	['La clave debe tener al menos 8 caracteres, con letras y números', 'The password must be at least 8 characters long, with letters and numbers', 'Le mot de passe doit contenir au moins 8 caractères, avec des lettres et des chiffres'],
	['El correo no es válido', 'The email is not valid', "L'adresse e-mail n'est pas valide"],
	['Solo el administrador general puede manejar perfiles administrativos', 'Only the general administrator can manage administrative profiles', "Seul l'administrateur général peut gérer les profils administratifs"],
	['No existe el rol $1 en Directus', 'The role $1 does not exist in Directus', "Le rôle $1 n'existe pas dans Directus"],
	['El colaborador no existe o no es de Will Go', 'The staff member does not exist or is not from Will Go', "Le collaborateur n'existe pas ou n'appartient pas à Will Go"],
	['El rol debe ser docente, banco, cajero o administrativo', 'The role must be teacher, bank, cashier or administrative', 'Le rôle doit être enseignant, banque, caissier ou administratif'],
	['Ya existe un usuario con ese correo', 'A user with that email already exists', 'Un utilisateur avec cette adresse e-mail existe déjà'],
	['No puedes desactivar tu propio usuario', 'You cannot deactivate your own user', 'Vous ne pouvez pas désactiver votre propre utilisateur'],
	['estado debe ser active o suspended', 'estado must be active or suspended', 'estado doit être active ou suspended'],
	['No puedes eliminar tu propio usuario', 'You cannot delete your own user', 'Vous ne pouvez pas supprimer votre propre utilisateur'],
	['$1 tiene movimientos en una edición activa; para no perder el historial, desactívalo en lugar de eliminarlo', '$1 has movements in an active edition; to keep the history, deactivate them instead of deleting them', "$1 a des mouvements dans une édition active ; pour garder l'historique, désactivez-le au lieu de le supprimer"],
	['$1 todavía tiene dinero; desactívalo en lugar de eliminarlo', '$1 still has money; deactivate them instead of deleting them', "$1 a encore de l'argent ; désactivez-le au lieu de le supprimer"],

	// Rúbrica
	['Elige el nivel (0 a 3) de los 4 criterios', 'Choose the level (0 to 3) for all 4 criteria', 'Choisissez le niveau (0 à 3) des 4 critères'],
	['El idioma debe ser inglés o francés', 'The language must be English or French', "La langue doit être l'anglais ou le français"],
	['El estudiante no existe', 'The student does not exist', "L'élève n'existe pas"],
	['El estudiante no tiene país asignado', 'The student has no country assigned', "L'élève n'a pas de pays attribué"],
	['La calificación no existe', 'The grade does not exist', "L'évaluation n'existe pas"],
	['Solo puedes deshacer tus calificaciones', 'You can only undo your own grades', 'Vous ne pouvez annuler que vos propres évaluations'],
	['Solo se puede deshacer en los primeros $1 minutos', 'It can only be undone within the first $1 minutes', "L'annulation n'est possible que pendant les $1 premières minutes"],

	// W-Funds
	['Los billetes suman $1 y debe entregar $2', 'The bills add up to $1 and you must hand over $2', 'Les billets totalisent $1 et vous devez remettre $2'],
	['Hay una ronda abierta: ciérrala con «Cerrar y detener las rondas»', 'A round is open: close it with “Close and stop rounds”', 'Une manche est ouverte : clôturez-la avec « Clôturer et arrêter les manches »'],
	['La inversión no existe', 'The investment does not exist', "L'investissement n'existe pas"],
	['Esta inversión ya fue retirada', 'This investment has already been withdrawn', 'Cet investissement a déjà été retiré'],
	['Estamos calculando las ganancias de la ronda; intenta en un minuto', "We're calculating the round's earnings; try again in a minute", 'Nous calculons les gains de la manche ; réessayez dans une minute'],
	['Indica los billetes que le entregas al estudiante', 'Specify the bills you are handing to the student', "Indiquez les billets que vous remettez à l'élève"],
	['La ronda debe durar $1 minutos', 'The round must last $1 minutes', 'La manche doit durer $1 minutes'],
	['Ya hay una ronda abierta; ciérrala antes de abrir otra', 'A round is already open; close it before opening another', "Une manche est déjà ouverte ; clôturez-la avant d'en ouvrir une autre"],
	['Fuera del horario de la economía (o le quedan menos de 5 minutos)', 'Outside the economy schedule (or less than 5 minutes remain)', "En dehors de l'horaire de l'économie (ou il reste moins de 5 minutes)"],
];

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Los mensajes sin valores se buscan exactos; los demás, con regex. Primero las plantillas con más texto fijo,
// para que «… billetes de $2 para el vuelto» gane sobre «… billetes de $2».
const MENSAJES_EXACTOS = new Map();
const PATRONES_MENSAJES = [];
for (const [es, en, fr] of TRADUCCIONES) {
	if (!/\$\d/.test(es)) { MENSAJES_EXACTOS.set(es, { en, fr }); continue; }
	const partes = es.split(/\$\d/);
	PATRONES_MENSAJES.push({
		regex: new RegExp(`^${partes.map(escaparRegex).join('(.+?)')}$`, 's'),
		fijo: partes.join('').length,
		en, fr,
	});
}
PATRONES_MENSAJES.sort((a, b) => b.fijo - a.fijo);

/** Cantidad de mensajes traducibles (exactos + plantillas). */
export const TOTAL_MENSAJES = MENSAJES_EXACTOS.size + PATRONES_MENSAJES.length;

/** Traduce un mensaje de error (escrito en español) al idioma pedido; si no lo conoce, lo deja en español. */
export function traducirMensaje(mensaje, idioma) {
	if (idioma !== 'en' && idioma !== 'fr') return mensaje;
	const texto = String(mensaje ?? '');
	const exacto = MENSAJES_EXACTOS.get(texto);
	if (exacto) return exacto[idioma];
	for (const patron of PATRONES_MENSAJES) {
		const m = patron.regex.exec(texto);
		if (m) return patron[idioma].replace(/\$(\d)/g, (_, n) => m[Number(n)] ?? '');
	}
	return mensaje;
}
