/**
 * Amazon Transcribe Medical Client for Supabase Edge Functions
 * Specialized for medical vocabulary in Portuguese (Brazil)
 * 
 * Required environment variables:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION (default: us-east-1)
 * - AWS_S3_BUCKET (for audio file storage)
 */

const AWS_REGION = Deno.env.get("AWS_REGION") || "us-east-1";
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID") || "";
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY") || "";
const AWS_S3_BUCKET = Deno.env.get("AWS_S3_BUCKET") || "";

interface TranscriptionJob {
  TranscriptionJobName: string;
  TranscriptionJobStatus: "QUEUED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  LanguageCode: string;
  MediaFormat: string;
  Media: { MediaFileUri: string };
  Transcript?: { TranscriptFileUri: string };
  StartTime?: string;
  CompletionTime?: string;
  FailureReason?: string;
}

interface TranscriptionResult {
  jobName: string;
  status: string;
  transcript?: string;
  error?: string;
}

/**
 * Sign AWS request using Signature Version 4
 */
async function signRequest(
  method: string,
  url: string,
  body: string,
  service: string,
  contentType = "application/x-amz-json-1.1"
): Promise<Headers> {
  const encoder = new TextEncoder();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  const canonicalUri = parsedUrl.pathname;

  const payloadHash = await crypto.subtle.digest("SHA-256", encoder.encode(body));
  const payloadHashHex = Array.from(new Uint8Array(payloadHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";

  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHashHex,
  ].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;

  const canonicalRequestHash = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(canonicalRequest)
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHashHex].join("\n");

  async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key instanceof ArrayBuffer ? key : key.buffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  }

  const kDate = await hmacSha256(encoder.encode(`AWS4${AWS_SECRET_ACCESS_KEY}`), dateStamp);
  const kRegion = await hmacSha256(kDate, AWS_REGION);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = await hmacSha256(kSigning, stringToSign);

  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authorizationHeader = `${algorithm} Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  return new Headers({
    "Content-Type": contentType,
    "X-Amz-Date": amzDate,
    "X-Amz-Target": "",
    Authorization: authorizationHeader,
  });
}

/**
 * Upload audio file to S3
 */
export async function uploadAudioToS3(
  audioData: Uint8Array,
  fileName: string,
  contentType: string
): Promise<string> {
  if (!AWS_S3_BUCKET) {
    throw new Error("AWS_S3_BUCKET not configured");
  }

  const url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${fileName}`;
  
  const encoder = new TextEncoder();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await crypto.subtle.digest("SHA-256", audioData);
  const payloadHashHex = Array.from(new Uint8Array(payloadHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const canonicalHeaders = `content-type:${contentType}\nhost:${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com\nx-amz-content-sha256:${payloadHashHex}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    `/${fileName}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHashHex,
  ].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${AWS_REGION}/s3/aws4_request`;

  const canonicalRequestHash = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(canonicalRequest)
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHashHex].join("\n");

  async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key instanceof ArrayBuffer ? key : key.buffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  }

  const kDate = await hmacSha256(encoder.encode(`AWS4${AWS_SECRET_ACCESS_KEY}`), dateStamp);
  const kRegion = await hmacSha256(kDate, AWS_REGION);
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = await hmacSha256(kSigning, stringToSign);

  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authorizationHeader = `${algorithm} Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "X-Amz-Date": amzDate,
      "X-Amz-Content-Sha256": payloadHashHex,
      Authorization: authorizationHeader,
    },
    body: audioData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`S3 upload error: ${response.status} - ${errorText}`);
  }

  return `s3://${AWS_S3_BUCKET}/${fileName}`;
}

/**
 * Start a medical transcription job
 */
export async function startMedicalTranscription(
  audioS3Uri: string,
  jobName: string,
  mediaFormat: "mp3" | "mp4" | "wav" | "flac" | "ogg" | "webm" = "mp3",
  specialty: "PRIMARYCARE" | "CARDIOLOGY" | "NEUROLOGY" | "ONCOLOGY" | "RADIOLOGY" | "UROLOGY" = "PRIMARYCARE"
): Promise<string> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials not configured");
  }

  const url = `https://transcribe.${AWS_REGION}.amazonaws.com/`;

  const body = JSON.stringify({
    MedicalTranscriptionJobName: jobName,
    LanguageCode: "pt-BR",
    MediaFormat: mediaFormat,
    Media: {
      MediaFileUri: audioS3Uri,
    },
    OutputBucketName: AWS_S3_BUCKET,
    Specialty: specialty,
    Type: "DICTATION",
  });

  const headers = await signRequest("POST", url, body, "transcribe");
  headers.set("X-Amz-Target", "Transcribe.StartMedicalTranscriptionJob");

  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcribe API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.MedicalTranscriptionJob?.MedicalTranscriptionJobName || jobName;
}

/**
 * Get transcription job status and result
 */
export async function getMedicalTranscriptionJob(jobName: string): Promise<TranscriptionResult> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials not configured");
  }

  const url = `https://transcribe.${AWS_REGION}.amazonaws.com/`;

  const body = JSON.stringify({
    MedicalTranscriptionJobName: jobName,
  });

  const headers = await signRequest("POST", url, body, "transcribe");
  headers.set("X-Amz-Target", "Transcribe.GetMedicalTranscriptionJob");

  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcribe API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const job = data.MedicalTranscriptionJob;

  const result: TranscriptionResult = {
    jobName: job.MedicalTranscriptionJobName,
    status: job.TranscriptionJobStatus,
  };

  if (job.TranscriptionJobStatus === "COMPLETED" && job.Transcript?.TranscriptFileUri) {
    // Fetch the transcript from S3
    const transcriptResponse = await fetch(job.Transcript.TranscriptFileUri);
    if (transcriptResponse.ok) {
      const transcriptData = await transcriptResponse.json();
      result.transcript = transcriptData.results?.transcripts?.[0]?.transcript || "";
    }
  } else if (job.TranscriptionJobStatus === "FAILED") {
    result.error = job.FailureReason;
  }

  return result;
}

/**
 * Transcribe audio file (convenience function that handles the full flow)
 * Note: This starts the job and returns immediately. Use getMedicalTranscriptionJob to poll for results.
 */
export async function transcribeAudio(
  audioData: Uint8Array,
  fileName: string,
  contentType: string,
  specialty: "PRIMARYCARE" | "CARDIOLOGY" | "NEUROLOGY" | "ONCOLOGY" | "RADIOLOGY" | "UROLOGY" = "PRIMARYCARE"
): Promise<{ jobName: string; s3Uri: string }> {
  // Determine media format from content type
  const formatMap: Record<string, "mp3" | "mp4" | "wav" | "flac" | "ogg" | "webm"> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "mp4",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/flac": "flac",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
  };

  const mediaFormat = formatMap[contentType] || "mp3";
  const jobName = `medical-transcription-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Upload to S3
  const s3Uri = await uploadAudioToS3(audioData, fileName, contentType);

  // Start transcription job
  await startMedicalTranscription(s3Uri, jobName, mediaFormat, specialty);

  return { jobName, s3Uri };
}

export type { TranscriptionJob, TranscriptionResult };
