import { embed, qdrant } from "../qdrant";

export async function retrieveBrandVoice(args: {
  brandProfileId: string;
  topic: string;
}): Promise<string> {
  const vector = await embed(args.topic);

  const results = await qdrant.search(`brand_${args.brandProfileId}`, {
    vector,
    limit: 8,
    filter: {
      must: [
        { key: "brandProfileId", match: { value: args.brandProfileId } },
        { key: "type", match: { any: ["voice_rule", "tone_descriptor", "brand_statement"] } },
      ],
    },
  });

  const voiceText = results
    .map((r) => r.payload?.["text"] as string | undefined)
    .filter(Boolean)
    .join("\n");

  return JSON.stringify({
    voiceRules: voiceText.split("\n").filter(Boolean),
    rawText: voiceText,
  });
}
