import { supabase } from "../supabase";


async function draw(source, maxSide) {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const toBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't encode the image."))),
      type,
      quality,
    ),
  );

// Prepares a sketch, screenshot or moodboard to send along with a prompt.
export async function toAttachment(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("That image is over 20 MB.");
  }
  const canvas = await draw(file, 1600);
  const blob = await toBlob(canvas, "image/jpeg", 0.85);
  const data = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(blob);
  });
  return {
    mimeType: "image/jpeg",
    data,
    preview: URL.createObjectURL(blob),
    name: file.name,
  };
}

// Deletes every artwork file in the user's folder (one subfolder per project).
export async function removeAllArtwork(userId) {
  const bucket = supabase.storage.from("artwork");
  const { data: folders } = await bucket.list(userId, { limit: 1000 });
  for (const folder of folders || []) {
    const { data: files } = await bucket.list(`${userId}/${folder.name}`, {
      limit: 1000,
    });
    if (files?.length) {
      await bucket.remove(
        files.map((f) => `${userId}/${folder.name}/${f.name}`),
      );
    }
  }
}
