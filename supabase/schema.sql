-- extension para UUIDs
--CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- tipos enum
CREATE TYPE tipo_division AS ENUM ('equitativo', 'porcentual', 'montos_exactos', 'por_cuotas');
create type estado_evento as enum ('abierto', 'finalizado');
create type estado_pago as enum ('pendiente', 'reportado', 'saldado');

-- tablas
create table usuarios (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    nombre text not null,
    telefono text unique,
    foto_url text,
    creado_en timestamptz default now()
);

create table datos_bancarios (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references usuarios(id) on delete cascade,
    banco text not null,
    tipo_cuenta text not null,
    numero_cuenta text not null,
    rut text not null,
    creado_en timestamptz default now()
);

create table contactos (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references usuarios(id) on delete cascade,
    referencia_usuario_id uuid references usuarios(id) on delete set null,
    nombre text not null,
    telefono text,
    es_temporal boolean default false,
    creado_en timestamptz default now()
);

create table grupos_contacto (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references usuarios(id) on delete cascade,
    nombre text not null
);

create table contactos_grupos (
    contacto_id uuid references contactos(id) on delete cascade,
    grupo_id uuid references grupos_contacto(id) on delete cascade,
    primary key (contacto_id, grupo_id)
);

create table eventos (
    id uuid primary key default gen_random_uuid(),
    creador_id uuid not null references usuarios(id) on delete cascade,
    titulo text not null,
    descripcion text,
    ubicacion text,
    fecha_evento timestamptz not null,
    estado estado_evento default 'abierto',
    creado_en timestamptz default now()
);

create table participantes_evento (
    evento_id uuid references eventos(id) on delete cascade,
    contacto_id uuid references contactos(id) on delete cascade,
    rol text default 'participante',
    primary key (evento_id, contacto_id)
);

create table gastos (
    id uuid primary key default gen_random_uuid(),
    evento_id uuid not null references eventos(id) on delete cascade,
    descripcion text not null,
    categoria text,
    monto_total numeric(12, 2) not null check (monto_total > 0),
    fecha timestamptz default now(),
    tipo_division tipo_division not null
);

create table gastos_pagadores (
    gasto_id uuid references gastos(id) on delete cascade,
    contacto_id uuid references contactos(id) on delete cascade,
    monto_aportado numeric(12, 2) not null check (monto_aportado > 0),
    primary key (gasto_id, contacto_id)
);

create table gastos_consumidores (
    gasto_id uuid references gastos(id) on delete cascade,
    contacto_id uuid references contactos(id) on delete cascade,
    parte numeric(12, 4) not null check (parte > 0),
    primary key (gasto_id, contacto_id)
);

create table pagos (
    id uuid primary key default gen_random_uuid(),
    evento_id uuid not null references eventos(id) on delete cascade,
    deudor_id uuid not null references contactos(id) on delete cascade,
    acreedor_id uuid not null references contactos(id) on delete cascade,
    monto numeric(12, 2) not null check (monto > 0),
    estado estado_pago default 'pendiente',
    confirmado_en timestamptz,
    creado_en timestamptz default now()
);

create table comprobantes (
    id uuid primary key default gen_random_uuid(),
    gasto_id uuid references gastos(id) on delete cascade,
    pago_id uuid references pagos(id) on delete cascade,
    storage_path text not null,
    mime_type text not null,
    creado_en timestamptz default now(),
    constraint comprobantes_origen_unico_check check (
        (gasto_id is not null and pago_id is null)
        or
        (gasto_id is null and pago_id is not null)
    )
);

create table log_auditoria (
    id uuid primary key default gen_random_uuid(),
    evento_id uuid references eventos(id) on delete cascade,
    usuario_id uuid references usuarios(id) on delete set null,
    accion text not null,
    payload jsonb,
    timestamp timestamptz default now()
);

create table notificaciones (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references usuarios(id) on delete cascade,
    evento_id uuid references eventos(id) on delete cascade,
    tipo text not null,
    titulo text not null,
    cuerpo text,
    leida boolean default false,
    creado_en timestamptz default now()
);

-- row level security
alter table usuarios enable row level security;
alter table datos_bancarios enable row level security;
alter table contactos enable row level security;
alter table grupos_contacto enable row level security;
alter table contactos_grupos enable row level security;
alter table eventos enable row level security;
alter table participantes_evento enable row level security;
alter table gastos enable row level security;
alter table gastos_pagadores enable row level security;
alter table gastos_consumidores enable row level security;
alter table pagos enable row level security;
alter table comprobantes enable row level security;
alter table log_auditoria enable row level security;
alter table notificaciones enable row level security;

-- funciones para evitar recursión infinita en RLS
create or replace function es_participante_evento(p_evento_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from participantes_evento pe
    join contactos c on c.id = pe.contacto_id
    where pe.evento_id = p_evento_id
    and c.referencia_usuario_id = auth.uid()
  );
$$;

create or replace function es_creador_evento(p_evento_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from eventos e
    where e.id = p_evento_id and e.creador_id = auth.uid()
  );
$$;

-- usuarios: cada uno ve y edita solo su perfil
create policy "usuarios: ver propio" on usuarios for select using (auth.uid() = id);
create policy "usuarios: editar propio" on usuarios for update using (auth.uid() = id);
create policy "usuarios: insertar propio" on usuarios for insert with check (auth.uid() = id);
create policy "usuarios: buscar por telefono" on usuarios for select using (auth.uid() is not null);

-- datos_bancarios: solo el dueño edita; acreedores con deuda activa pueden leer
create policy "datos_bancarios: dueño gestiona" on datos_bancarios
    for all using (auth.uid() = usuario_id);

create policy "datos_bancarios: acreedor puede leer" on datos_bancarios
    for select using (
    exists (
        select 1 from pagos p
        join contactos c on c.id = p.acreedor_id
        where c.referencia_usuario_id = auth.uid()
        and p.deudor_id in (
            select id from contactos where referencia_usuario_id = datos_bancarios.usuario_id
        )
        and p.estado != 'saldado'
    )
    );

-- contactos: el dueño gestiona los suyos
create policy "contactos: dueño gestiona" on contactos
    for all using (auth.uid() = usuario_id);

-- grupos_contacto: el dueño gestiona los suyos
create policy "grupos_contacto: dueño gestiona" on grupos_contacto
    for all using (auth.uid() = usuario_id);

-- contactos_grupos: el dueño del contacto gestiona
create policy "contactos_grupos: dueño gestiona" on contactos_grupos
    for all using (
    exists (
        select 1 from contactos c where c.id = contacto_id and c.usuario_id = auth.uid()
    )
    );

-- eventos: participantes pueden leer; creador puede modificar
create policy "eventos: participantes leen" on eventos
    for select using (
    auth.uid() = creador_id or
    exists (
        select 1 from participantes_evento pe
        join contactos c on c.id = pe.contacto_id
        where pe.evento_id = eventos.id and c.referencia_usuario_id = auth.uid()
    )
    );

create policy "eventos: creador gestiona" on eventos
    for all using (auth.uid() = creador_id);

-- participantes_evento: participantes del evento pueden leer
create policy "participantes_evento: participantes leen" on participantes_evento
    for select using (
        es_participante_evento(evento_id)
    );

create policy "participantes_evento: creador gestiona" on participantes_evento
    for all using (
        es_creador_evento(evento_id)
    );

-- gastos_pagadores y gastos_consumidores: igual que gastos
create policy "gastos_pagadores: participantes gestionan" on gastos_pagadores
    for all using (
    exists (
        select 1 from gastos g
        join participantes_evento pe on pe.evento_id = g.evento_id
        join contactos c on c.id = pe.contacto_id
        where g.id = gasto_id and c.referencia_usuario_id = auth.uid()
    )
    );

create policy "gastos_consumidores: participantes gestionan" on gastos_consumidores
    for all using (
    exists (
        select 1 from gastos g
        join participantes_evento pe on pe.evento_id = g.evento_id
        join contactos c on c.id = pe.contacto_id
        where g.id = gasto_id and c.referencia_usuario_id = auth.uid()
    )
    );

-- pagos: participantes del evento pueden leer y gestionar
create policy "pagos: participantes gestionan" on pagos
    for all using (
    exists (
        select 1 from participantes_evento pe
        join contactos c on c.id = pe.contacto_id
        where pe.evento_id = pagos.evento_id and c.referencia_usuario_id = auth.uid()
    )
    );

-- gastos: participantes del evento pueden leer y crear
create policy "gastos: participantes gestionan" on gastos
    for all using (
    exists (
        select 1 from participantes_evento pe
        join contactos c on c.id = pe.contacto_id
        where pe.evento_id = gastos.evento_id and c.referencia_usuario_id = auth.uid()
    )
    );

-- comprobantes: participantes del evento del gasto o pago pueden leer
create policy "comprobantes: participantes leen" on comprobantes
    for select using (
    (
        gasto_id is not null
        and exists (
            select 1 from gastos g
            join participantes_evento pe on pe.evento_id = g.evento_id
            join contactos c on c.id = pe.contacto_id
            where g.id = gasto_id and c.referencia_usuario_id = auth.uid()
        )
    )
    or
    (
        pago_id is not null
        and exists (
            select 1 from pagos p
            join participantes_evento pe on pe.evento_id = p.evento_id
            join contactos c on c.id = pe.contacto_id
            where p.id = pago_id and c.referencia_usuario_id = auth.uid()
        )
    )
    );

create policy "comprobantes: participantes crean" on comprobantes
    for insert with check (
    (
        gasto_id is not null
        and pago_id is null
        and exists (
            select 1 from gastos g
            join participantes_evento pe on pe.evento_id = g.evento_id
            join contactos c on c.id = pe.contacto_id
            where g.id = gasto_id and c.referencia_usuario_id = auth.uid()
        )
    )
    or
    (
        pago_id is not null
        and gasto_id is null
        and exists (
            select 1 from pagos p
            join participantes_evento pe on pe.evento_id = p.evento_id
            join contactos c on c.id = pe.contacto_id
            where p.id = pago_id and c.referencia_usuario_id = auth.uid()
        )
    )
    );

-- log_auditoria: participantes leen; escritura solo vía service role (Edge Functions)
-- storage: bucket privado para imagenes de comprobantes
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

create policy "comprobantes storage: usuarios autenticados suben"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'comprobantes');

create policy "comprobantes storage: participantes leen"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'comprobantes'
  and exists (
    select 1
    from comprobantes comp
    left join pagos p on p.id = comp.pago_id
    left join gastos g on g.id = comp.gasto_id
    join participantes_evento pe on pe.evento_id = coalesce(p.evento_id, g.evento_id)
    join contactos c on c.id = pe.contacto_id
    where comp.storage_path = storage.objects.name
      and c.referencia_usuario_id = auth.uid()
  )
);

create policy "log_auditoria: participantes leen" on log_auditoria
    for select using (
    exists (
        select 1 from participantes_evento pe
        join contactos c on c.id = pe.contacto_id
        where pe.evento_id = log_auditoria.evento_id and c.referencia_usuario_id = auth.uid()
    )
    );

-- notificaciones: cada usuario ve las suyas
create policy "notificaciones: usuario propio" on notificaciones
    for all using (auth.uid() = usuario_id);

-- trigger: crear fila en usuarios al registrarse
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.usuarios (id, email, nombre, telefono)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'telefono'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Crear la función interna que procesa el registro e interactúa con la API de Expo
CREATE OR REPLACE FUNCTION public.enviar_notificacion_push_expo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_push_token text;
BEGIN
    -- Buscamos el push_token del usuario al que va dirigida la notificación
    SELECT push_token INTO v_push_token 
    FROM public.usuarios 
    WHERE id = NEW.usuario_id;

    -- Si el usuario tiene un token activo registrado, disparamos el POST síncrono a Expo
    IF v_push_token IS NOT NULL AND v_push_token LIKE 'ExponentPushToken%' THEN
        PERFORM net.http_post(
            url := 'https://exp.host/--/api/v2/push/send',
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := json_build_object(
                'to', v_push_token,
                'title', NEW.titulo,
                'body', COALESCE(NEW.cuerpo, ''),
                'sound', 'default',
                'data', json_build_object('eventoId', NEW.evento_id)
            )::text::bytea
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Vincular la función mediante un trigger automático posterior a cada inserción
CREATE OR REPLACE TRIGGER on_notification_created
AFTER INSERT ON public.notificaciones
FOR EACH ROW
EXECUTE FUNCTION public.enviar_notificacion_push_expo();