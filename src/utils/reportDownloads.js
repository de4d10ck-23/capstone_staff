export async function reportResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'The report could not be loaded.');
  }
  return response;
}

export async function downloadReport(API_URL, token, id, format = 'csv') {
  const response = await reportResponse(await fetch(`${API_URL}/reports/${encodeURIComponent(id)}/download?format=${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `WaterWatch-${id}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
