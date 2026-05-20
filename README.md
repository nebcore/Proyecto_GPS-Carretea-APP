# Proyecto GPS — Carretea

Aplicación móvil desarrollada con **Expo + React Native + TypeScript**.

El proyecto base de Expo ya está inicializado. Estos son los pasos para que cualquiera pueda trabajar en él.

## Requisitos previos

- [Node.js](https://nodejs.org/) instalado (versión LTS).
- La app **Expo Go** en el celular Android (Play Store), o un emulador de Android.

## Cómo empezar

1. Clonar el repositorio

   ```bash
   git clone https://github.com/nebcore/Proyecto_GPS-Carretea-APP.git
   cd Proyecto_GPS-Carretea-APP
   ```

2. Instalar las dependencias

   ```bash
   npm install
   ```

3. Iniciar el servidor de desarrollo

   ```bash
   npx expo start
   ```

   Escanea el código QR con la app Expo Go, o pulsa `a` para abrirlo en un emulador de Android.

## Comandos útiles

| Comando           | Para qué sirve                                                 |
| ----------------- | -------------------------------------------------------------- |
| `npm install`     | Instala o actualiza las dependencias del proyecto.             |
| `npx expo start`  | Levanta el servidor de desarrollo.                             |
| `npm run android` | Abre la app directamente en un emulador o dispositivo Android. |

## Flujo de trabajo con Git

Este proyecto usa un flujo basado en Git Flow. Reglas básicas:

- **`main`**: contiene solo versiones estables y presentables (cada entrega o hito del proyecto).
- **`develop`**: rama de integración; aquí se reúne todo el trabajo en curso.
- Las ramas de funcionalidad salen de `develop` y vuelven a `develop`.
- Cuando `develop` está estable, se hace _merge_ a `main` y se marca la versión con un _tag_.
- **Nunca se trabaja directamente sobre `main` ni sobre `develop`**: siempre en una rama propia.

### Nombres de ramas

| Prefijo     | Para qué sirve           | Ejemplo                    |
| ----------- | ------------------------ | -------------------------- |
| `feature/`  | Una funcionalidad nueva  | `feature/login`            |
| `fix/`      | Corregir un bug          | `fix/calculo-gastos`       |
| `docs/`     | Cambios de documentación | `docs/readme`              |
| `refactor/` | Solo reorganizar código  | `refactor/registro-gastos` |

### Pasos para trabajar en una funcionalidad

1. Actualizar `develop` con lo último del repositorio

   ```bash
   git checkout develop
   git pull
   ```

2. Crear la rama de trabajo a partir de `develop`

   ```bash
   git checkout -b feature/nombre-de-la-tarea
   ```

3. Hacer commits a medida que avanzas

   ```bash
   git add .
   git commit -m "Descripción breve del cambio"
   ```

4. Subir la rama a GitHub

   ```bash
   git push -u origin feature/nombre-de-la-tarea
   ```

5. Abrir un **Pull Request** en GitHub **hacia `develop`** y esperar la revisión de un compañero.

6. Cuando el Pull Request se haya fusionado, borrar la rama local

   ```bash
   git checkout develop
   git pull
   git branch -d feature/nombre-de-la-tarea
   ```

### Publicar una versión estable

Cuando `develop` esté lista para una entrega o hito, se integra a `main`:

```bash
git checkout main
git pull
git merge develop
git push
git tag v0.1-prototipo
git push --tags
```

### Consideraciones

Posterior al desarrollo del prototipo se está considerando integrar ramas `release/` y `hotfix/` para preparar entregar y arreglos urgentes sobre `main`.
