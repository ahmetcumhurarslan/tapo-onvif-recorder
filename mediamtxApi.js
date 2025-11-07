const axios = require('axios');

const API_BASE = "http://127.0.0.1:9997/v3/config/paths";

async function listPaths() {
  try {
    const { data } = await axios.get(`${API_BASE}/list`);
    return data.items || [];
  } catch (err) {
    console.error('listPaths error:', err.message);
    return [];
  }
}

async function deletePath(name) {
  try {
    await axios.delete(`${API_BASE}/delete/${encodeURIComponent(name)}`);
    return true;
  } catch (err) {
    console.error(`deletePath(${name}) error:`, err.message);
    return false;
  }
}

async function getPath(name) {
  try {
    const { data } = await axios.get(`${API_BASE}/get/${encodeURIComponent(name)}`);
    console.log("get data:",data);
    return data;
  } catch (err) {
    console.error(`deletePath(${name}) error:`, err.message);
    return null;
  }
}

async function addPath(name, sourceUrl, opts = {}) {
  const payload = {
    name,
    source: sourceUrl,
    sourceOnDemand: true,
    ...opts
  };
  try {
    await axios.post(`${API_BASE}/add/${encodeURIComponent(name)}`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`Added path: ${name} -> ${sourceUrl}`);
    return true;
  } catch (err) {
    console.error(`addPath(${name}) error:`, err.message);
    return false;
  }
}

async function deleteAllPaths() {
  const paths = await listPaths();
  for (const p of paths) await deletePath(p.name);
  console.log(`Deleted ${paths.length} paths`);
}

module.exports = { listPaths, deletePath, addPath, deleteAllPaths, getPath };