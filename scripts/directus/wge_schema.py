"""Crea las colecciones de WILL-GO ECONOMY en Directus (idempotente: omite lo que ya existe).
Uso: python3 wge_schema.py [--dry-run]"""
import json, subprocess, sys

API = 'https://api.appthinkingmind.com'
DRY = '--dry-run' in sys.argv
GROUP = 'will_go_economy'


def call(method, path, body=None):
    cmd = ['curl', '-gsS', '-X', method, '-H', 'Content-Type: application/json', API + path]
    if body is not None:
        cmd += ['-d', json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    return json.loads(out) if out.strip() else {}


# ---------- Ayudantes de campos ----------
def pk():
    return {'field': 'id', 'type': 'uuid', 'meta': {'hidden': True, 'readonly': True, 'interface': 'input', 'special': ['uuid']},
            'schema': {'is_primary_key': True, 'length': 36, 'has_auto_increment': False}}

def campo(field, tipo, nota=None, default=None, unico=False, requerido=False, opciones=None, interfaz=None):
    meta = {'note': nota} if nota else {}
    if opciones:
        meta.update({'interface': 'select-dropdown', 'options': {'choices': [{'text': o, 'value': o} for o in opciones]}})
    elif interfaz:
        meta['interface'] = interfaz
    if requerido:
        meta['required'] = True
    schema = {}
    if default is not None:
        schema['default_value'] = default
    if unico:
        schema['is_unique'] = True
    if tipo == 'decimal':
        schema.update({'numeric_precision': 12, 'numeric_scale': 4})
    return {'field': field, 'type': tipo, 'meta': meta, 'schema': schema}

def m2o(field, nota=None, requerido=False):
    meta = {'interface': 'select-dropdown-m2o', 'special': ['m2o']}
    if nota:
        meta['note'] = nota
    if requerido:
        meta['required'] = True
    return {'field': field, 'type': 'uuid', 'meta': meta, 'schema': {}}

def auditoria():
    return [
        {'field': 'date_created', 'type': 'timestamp', 'meta': {'special': ['date-created'], 'interface': 'datetime', 'readonly': True, 'hidden': True}, 'schema': {}},
        {'field': 'user_created', 'type': 'uuid', 'meta': {'special': ['user-created'], 'interface': 'select-dropdown-m2o', 'readonly': True, 'hidden': True}, 'schema': {}},
    ]

# relaciones: (colección, campo, colección relacionada, on_delete)
RELACIONES = []
def rel(col, field, related, on_delete='NO ACTION'):
    RELACIONES.append((col, field, related, on_delete))

EXT = 'SET NULL'  # referencias a colecciones existentes de la plataforma

# ---------- Colecciones ----------
COLECCIONES = []
def coleccion(nombre, icono, nota, campos):
    COLECCIONES.append({'collection': nombre, 'meta': {'icon': icono, 'note': nota, 'group': GROUP}, 'schema': {}, 'fields': [pk()] + campos + auditoria()})
    rel(nombre, 'user_created', 'directus_users', EXT)

coleccion('wge_ediciones', 'event', 'Cada fin de semana Will-Go', [
    campo('nombre', 'string', requerido=True),
    m2o('colegio_id'), m2o('curso_id', 'Programa de la plataforma (p. ej. Will Go Economy)'),
    campo('fecha_inicio', 'date'), campo('fecha_fin', 'date'),
    campo('horario', 'json', 'Horario por día, p. ej. [{"dia":"sabado","inicio":"08:00","fin":"20:00"}]', interfaz='input-code'),
    campo('zona_horaria', 'string', default='America/Bogota'),
    campo('tasa_inicial', 'integer', 'R0: pesos educativos por 1 billete', default=1000),
    campo('tope_minimo', 'decimal', 'Tasa mínima = tope × R0', default=0.70),
    campo('tope_maximo', 'decimal', 'Tasa máxima = tope × R0', default=1.80),
    campo('parametros_fx', 'json', 'Intervalo, referencia B, sensibilidad y límites de variación; la app pone los valores del documento si está vacío', interfaz='input-code'),
    campo('investment_bill', 'integer', 'Billetes de bienvenida por estudiante', default=0),
    campo('estado', 'string', default='borrador', opciones=['borrador', 'abierta', 'cerrada']),
])
rel('wge_ediciones', 'colegio_id', 'colegios', EXT)
rel('wge_ediciones', 'curso_id', 'Cursos', EXT)

coleccion('wge_paises', 'flag', 'Wonderland, Neverland y Dreamland de cada edición', [
    m2o('edicion_id', requerido=True), campo('nombre', 'string', requerido=True),
    campo('codigo_moneda', 'string'), campo('color', 'string', interfaz='select-color'),
    campo('tasa_actual', 'integer'), campo('provision_inicial', 'integer', 'Billetes del banco al abrir la edición', default=0),
    campo('orden', 'integer'),
])
rel('wge_paises', 'edicion_id', 'wge_ediciones')

coleccion('wge_participantes', 'badge', 'Estudiante inscrito en una edición (sus datos vienen de estudiantes)', [
    m2o('edicion_id', requerido=True), m2o('estudiante_id', requerido=True), m2o('pais_id', 'Lo asigna el administrador'),
    campo('codigo', 'string', 'Código corto para el QR', unico=True),
    campo('presente', 'boolean', default=False),
    campo('clave_unica', 'string', 'edicion:estudiante (evita duplicados)', unico=True),
])
rel('wge_participantes', 'edicion_id', 'wge_ediciones')
rel('wge_participantes', 'estudiante_id', 'estudiantes', EXT)
rel('wge_participantes', 'pais_id', 'wge_paises')

coleccion('wge_billeteras', 'account_balance_wallet', 'Saldo por dueño y moneda (solo lo cambian las operaciones de billetes)', [
    m2o('edicion_id', requerido=True), m2o('pais_id', 'Moneda de la billetera', requerido=True),
    campo('tipo_dueno', 'string', requerido=True, opciones=['banco', 'docente', 'estudiante']),
    m2o('docente_id'), m2o('participante_id'),
    campo('saldo', 'integer', default=0), campo('consecutivo', 'integer', 'Último consecutivo de movimiento', default=0),
    campo('clave_unica', 'string', 'edicion:pais:tipo:dueño', unico=True),
])
rel('wge_billeteras', 'edicion_id', 'wge_ediciones')
rel('wge_billeteras', 'pais_id', 'wge_paises')
rel('wge_billeteras', 'docente_id', 'directus_users', EXT)
rel('wge_billeteras', 'participante_id', 'wge_participantes')

coleccion('wge_transferencias', 'swap_horiz', 'Banco → docente y docente → estudiante', [
    m2o('edicion_id', requerido=True), m2o('pais_id', requerido=True),
    m2o('billetera_origen_id', requerido=True), m2o('billetera_destino_id', requerido=True),
    campo('monto', 'integer', requerido=True),
    campo('estado', 'string', default='aplicada', opciones=['aplicada', 'reversada']),
    campo('clave_idempotencia', 'string', unico=True),
])
rel('wge_transferencias', 'edicion_id', 'wge_ediciones')
rel('wge_transferencias', 'pais_id', 'wge_paises')
rel('wge_transferencias', 'billetera_origen_id', 'wge_billeteras')
rel('wge_transferencias', 'billetera_destino_id', 'wge_billeteras')

coleccion('wge_movimientos', 'receipt_long', 'Libro de movimientos: nunca se edita ni se borra', [
    m2o('billetera_id', requerido=True),
    campo('tipo', 'string', requerido=True, opciones=['provision', 'transferencia_salida', 'transferencia_entrada', 'bienvenida', 'compra', 'inversion', 'pago_fondo', 'reverso']),
    campo('monto', 'integer', 'Con signo: positivo entra, negativo sale', requerido=True),
    campo('saldo_despues', 'integer', requerido=True),
    campo('consecutivo', 'integer', requerido=True),
    campo('clave_consecutivo', 'string', 'billetera:consecutivo (evita gasto doble)', unico=True),
    campo('clave_idempotencia', 'string', unico=True),
    campo('referencia_tipo', 'string'), campo('referencia_id', 'string'),
])
rel('wge_movimientos', 'billetera_id', 'wge_billeteras')

coleccion('wge_evaluaciones', 'grading', 'Rúbrica del docente, aparte del dinero', [
    m2o('participante_id', requerido=True),
    campo('uso_lengua', 'integer'), campo('iniciativa', 'integer'), campo('nivel_reto', 'integer'), campo('colaboracion', 'integer'),
    campo('puntaje', 'integer'), campo('idioma', 'string', opciones=['ingles', 'frances']),
])
rel('wge_evaluaciones', 'participante_id', 'wge_participantes')

coleccion('wge_fx', 'show_chart', 'Historial del tipo de cambio por país', [
    m2o('pais_id', requerido=True), campo('ventana', 'timestamp'),
    campo('participantes_presentes', 'integer'), campo('puntos', 'decimal'), campo('indice', 'decimal'),
    campo('tasa_anterior', 'integer'), campo('tasa_nueva', 'integer'),
])
rel('wge_fx', 'pais_id', 'wge_paises')

coleccion('wge_productos', 'storefront', 'Catálogo de GO•STORE por edición', [
    m2o('edicion_id', requerido=True), campo('nombre', 'string', requerido=True),
    {'field': 'foto', 'type': 'uuid', 'meta': {'interface': 'file-image', 'special': ['file']}, 'schema': {}},
    campo('precio_cop', 'integer', 'Precio en pesos educativos', requerido=True),
    campo('stock', 'integer', default=0), campo('maximo_por_estudiante', 'integer'),
    campo('activo', 'boolean', default=True),
])
rel('wge_productos', 'edicion_id', 'wge_ediciones')
rel('wge_productos', 'foto', 'directus_files', EXT)

coleccion('wge_ventas', 'shopping_cart', 'Cada compra en GO•STORE', [
    m2o('edicion_id', requerido=True), m2o('participante_id', requerido=True),
    campo('tasa_aplicada', 'integer'), campo('total_billetes', 'integer'),
    campo('numero_recibo', 'string', unico=True), m2o('movimiento_id'),
    campo('estado', 'string', default='pagada', opciones=['pagada', 'reversada']),
    campo('clave_idempotencia', 'string', unico=True),
])
rel('wge_ventas', 'edicion_id', 'wge_ediciones')
rel('wge_ventas', 'participante_id', 'wge_participantes')
rel('wge_ventas', 'movimiento_id', 'wge_movimientos')

coleccion('wge_venta_items', 'list', 'Productos de cada compra', [
    m2o('venta_id', requerido=True), m2o('producto_id', requerido=True),
    campo('cantidad', 'integer', default=1), campo('precio_billetes', 'integer'),
])
rel('wge_venta_items', 'venta_id', 'wge_ventas')
rel('wge_venta_items', 'producto_id', 'wge_productos')

coleccion('wge_fondos', 'savings', 'Fondos ficticios W-Funds por edición', [
    m2o('edicion_id', requerido=True), campo('nombre', 'string', requerido=True), campo('historia', 'text'),
    campo('riesgo', 'string', opciones=['bajo', 'medio', 'alto']),
    campo('rendimiento_base', 'decimal', 'Porcentaje, p. ej. 0.03 = 3 %'),
    campo('rendimiento_alterno', 'decimal', 'Escenario alterno, p. ej. -0.08 en riesgo alto'),
    campo('variacion', 'decimal', 'Variación ± al cierre, p. ej. 0.02'),
    campo('activo', 'boolean', default=True), campo('orden', 'integer'),
])
rel('wge_fondos', 'edicion_id', 'wge_ediciones')

coleccion('wge_rondas', 'timer', 'Rondas de inversión y votación', [
    m2o('edicion_id', requerido=True), campo('nombre', 'string'),
    campo('apertura', 'timestamp'), campo('cierre', 'timestamp'),
    campo('estado', 'string', default='abierta', opciones=['abierta', 'cerrada', 'liquidada']),
    campo('semilla', 'string', 'Semilla auditable de la variación'),
])
rel('wge_rondas', 'edicion_id', 'wge_ediciones')

coleccion('wge_inversiones', 'trending_up', 'Billetes que un estudiante pone en un fondo', [
    m2o('participante_id', requerido=True), m2o('fondo_id', requerido=True), m2o('ronda_id', requerido=True),
    campo('monto', 'integer', requerido=True), campo('rendimiento_final', 'decimal'), campo('monto_pagado', 'integer'),
    campo('estado', 'string', default='abierta', opciones=['abierta', 'liquidada']),
    campo('clave_idempotencia', 'string', unico=True),
])
rel('wge_inversiones', 'participante_id', 'wge_participantes')
rel('wge_inversiones', 'fondo_id', 'wge_fondos')
rel('wge_inversiones', 'ronda_id', 'wge_rondas')

coleccion('wge_votos', 'how_to_vote', 'Voto del acudiente por fondo y ronda', [
    m2o('acudiente_id', requerido=True), m2o('fondo_id', requerido=True), m2o('ronda_id', requerido=True),
    campo('clave_unica', 'string', 'acudiente:fondo:ronda (un voto por fondo)', unico=True),
])
rel('wge_votos', 'acudiente_id', 'clientes', EXT)
rel('wge_votos', 'fondo_id', 'wge_fondos')
rel('wge_votos', 'ronda_id', 'wge_rondas')


def main():
    existentes = {c['collection'] for c in call('GET', '/collections?limit=-1')['data']}
    print(f'{len(COLECCIONES)} colecciones, {len(RELACIONES)} relaciones' + (' (simulación)' if DRY else ''))
    if GROUP not in existentes:
        print('carpeta', GROUP)
        if not DRY:
            r = call('POST', '/collections', {'collection': GROUP, 'meta': {'icon': 'savings', 'note': 'WILL-GO ECONOMY: economía simulada de Will-Go'}, 'schema': None})
            if 'errors' in r: sys.exit(f'ERROR carpeta: {r["errors"]}')
    for c in COLECCIONES:
        if c['collection'] in existentes:
            print('ya existe', c['collection']); continue
        print('crear', c['collection'], len(c['fields']), 'campos')
        if not DRY:
            r = call('POST', '/collections', c)
            if 'errors' in r: sys.exit(f'ERROR {c["collection"]}: {r["errors"]}')
    actuales = {(r['collection'], r['field']) for r in call('GET', '/relations')['data']} if not DRY else set()
    for col, field, related, on_delete in RELACIONES:
        if (col, field) in actuales:
            continue
        if not DRY:
            r = call('POST', '/relations', {'collection': col, 'field': field, 'related_collection': related, 'schema': {'on_delete': on_delete}})
            if 'errors' in r: sys.exit(f'ERROR relación {col}.{field}: {r["errors"]}')
    print('listo')

main()
