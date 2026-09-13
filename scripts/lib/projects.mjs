/** Public project identities only. Outcomes and measurements belong to ideas. */
export function validateProjects(registry) {
  const errors = [];
  const ids = new Set();
  if (!registry || Array.isArray(registry) || !Array.isArray(registry.projects)) {
    return { ids, errors: ['Expected an object with a projects array.'] };
  }
  for (const key of Object.keys(registry)) if (key !== 'projects') errors.push(`Unknown registry field ${key}.`);
  const names = new Map();
  const normalize = value => value.trim().toLowerCase();
  for (const [n, project] of registry.projects.entries()) {
    const where = `projects[${n}]`;
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      errors.push(`${where} must be an object.`); continue;
    }
    for (const key of Object.keys(project)) if (!['id', 'label', 'aliases', 'links'].includes(key)) {
      errors.push(`${where}: unsupported field ${key}; store outcomes and measurements on ideas.`);
    }
    if (typeof project.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.id)) errors.push(`${where}: id must be kebab-case.`);
    else {
      if (ids.has(project.id)) errors.push(`${where}: duplicate id ${project.id}.`);
      ids.add(project.id);
    }
    if (typeof project.label !== 'string' || !project.label.trim()) errors.push(`${where}: label must be non-empty text.`);
    const aliases = project.aliases ?? [];
    if (!Array.isArray(aliases) || aliases.some(v => typeof v !== 'string' || !v.trim())) errors.push(`${where}: aliases must be a list of non-empty strings.`);
    const ownNames = new Set();
    for (const name of [project.id, project.label]) if (typeof name === 'string' && name.trim()) ownNames.add(normalize(name));
    if (Array.isArray(aliases)) for (const alias of aliases) if (typeof alias === 'string' && alias.trim()) {
      const name = normalize(alias);
      if (ownNames.has(name)) errors.push(`${where}: redundant or duplicate alias ${alias}.`);
      ownNames.add(name);
    }
    for (const name of ownNames) {
      if (names.has(name)) errors.push(`${where}: name or alias ${name} collides with ${names.get(name)}.`);
      else names.set(name, where);
    }
    if ('links' in project) {
      if (!project.links || typeof project.links !== 'object' || Array.isArray(project.links)) errors.push(`${where}: links must be a named URL object.`);
      else for (const [key, value] of Object.entries(project.links)) {
        try {
          const url = new URL(value);
          if (!key.trim() || typeof value !== 'string' || url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error();
        } catch { errors.push(`${where}: links.${key} must be an absolute HTTPS URL without credentials.`); }
      }
    }
  }
  return { ids, errors };
}
