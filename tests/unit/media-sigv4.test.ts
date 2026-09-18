import { describe, it, expect } from "vitest";
import { amzDate, EMPTY_SHA256, sha256Hex, signRequest, type SigningCredentials } from "@/server/media/sigv4";

// Vector mau chinh thuc cua AWS, muc "Examples: Signature Calculations" (GET Object, PUT Object) cua trang
// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
// Trang goc nay nay chuyen huong ve Welcome.html; gia tri duoc chep tu ban luu cua chinh trang do:
// https://web.archive.org/web/2025/https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html

const LF = String.fromCharCode(10);
const AWS: SigningCredentials = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
  service: "s3",
};
const NGAY_MAU = new Date("2013-05-24T00:00:00.000Z");
const SCOPE = "20130524/us-east-1/s3/aws4_request";
const HASH_PUT = "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072";

describe("signRequest: vector mau cua AWS", () => {
  it("GET Object: 10 byte dau cua test.txt", async () => {
    const r = await signRequest(
      { method: "GET", url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"), headers: { Range: "bytes=0-9" }, payloadHash: EMPTY_SHA256 },
      AWS,
      NGAY_MAU,
    );
    expect(r.canonicalRequest).toBe([
      "GET", "/test.txt", "",
      "host:examplebucket.s3.amazonaws.com", "range:bytes=0-9", `x-amz-content-sha256:${EMPTY_SHA256}`, "x-amz-date:20130524T000000Z", "",
      "host;range;x-amz-content-sha256;x-amz-date", EMPTY_SHA256,
    ].join(LF));
    expect(r.stringToSign).toBe(
      ["AWS4-HMAC-SHA256", "20130524T000000Z", SCOPE, "7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972"].join(LF),
    );
    expect(r.signature).toBe("f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
    expect(r.headers).toEqual({
      range: "bytes=0-9",
      "x-amz-content-sha256": EMPTY_SHA256,
      "x-amz-date": "20130524T000000Z",
      authorization: "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    });
  });

  it("PUT Object: test$file.text, co Date va x-amz-storage-class, than la Welcome to Amazon S3.", async () => {
    expect(await sha256Hex("Welcome to Amazon S3.")).toBe(HASH_PUT);
    const r = await signRequest(
      {
        method: "PUT",
        url: new URL("https://examplebucket.s3.amazonaws.com/test$file.text"),
        headers: { Date: "Fri, 24 May 2013 00:00:00 GMT", "x-amz-storage-class": "REDUCED_REDUNDANCY" },
        payloadHash: HASH_PUT,
      },
      AWS,
      NGAY_MAU,
    );
    expect(r.canonicalRequest).toBe([
      "PUT", "/test%24file.text", "",
      "date:Fri, 24 May 2013 00:00:00 GMT", "host:examplebucket.s3.amazonaws.com", `x-amz-content-sha256:${HASH_PUT}`,
      "x-amz-date:20130524T000000Z", "x-amz-storage-class:REDUCED_REDUNDANCY", "",
      "date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class", HASH_PUT,
    ].join(LF));
    expect(r.stringToSign).toBe(
      ["AWS4-HMAC-SHA256", "20130524T000000Z", SCOPE, "9e0e90d9c76de8fa5b200d8c849cd5b8dc7a3be3951ddb7f6a76b4158342019d"].join(LF),
    );
    expect(r.signature).toBe("98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd");
    expect(r.headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class,Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd",
    );
  });
});

describe("signRequest: luat chuan hoa", () => {
  const url = new URL("https://examplebucket.s3.amazonaws.com/test.txt");

  it("SHA-256 cua than rong dung EMPTY_SHA256; moc gio dang co ban", async () => {
    expect(await sha256Hex(new Uint8Array(0))).toBe(EMPTY_SHA256);
    expect(amzDate(new Date("2026-09-16T08:05:09.123Z"))).toBe("20260916T080509Z");
  });

  it("ten header khong phan biet hoa thuong, gia tri cat va gop khoang trang", async () => {
    const goc = await signRequest({ method: "GET", url, headers: { range: "bytes=0-9" }, payloadHash: EMPTY_SHA256 }, AWS, NGAY_MAU);
    const lech = await signRequest({ method: "GET", url, headers: { RANGE: "  bytes=0-9 " }, payloadHash: EMPTY_SHA256 }, AWS, NGAY_MAU);
    expect(lech.signature).toBe(goc.signature);
    const gop = await signRequest({ method: "GET", url, headers: { "x-meta": "a    b" }, payloadHash: EMPTY_SHA256 }, AWS, NGAY_MAU);
    expect(gop.canonicalRequest).toContain(`x-meta:a b${LF}`);
  });

  it("doi khoa bi mat, vung hay ngay thi doi chu ky; chu ky khong bao gio chua khoa", async () => {
    const req = { method: "GET", url, headers: {}, payloadHash: EMPTY_SHA256 };
    const goc = await signRequest(req, AWS, NGAY_MAU);
    const khac = await Promise.all([
      signRequest(req, { ...AWS, secretAccessKey: `${AWS.secretAccessKey}x` }, NGAY_MAU),
      signRequest(req, { ...AWS, region: "auto" }, NGAY_MAU),
      signRequest(req, AWS, new Date("2013-05-25T00:00:00.000Z")),
    ]);
    for (const r of khac) expect(r.signature).not.toBe(goc.signature);
    expect(JSON.stringify(goc)).not.toContain(AWS.secretAccessKey);
  });

  it("khong ky query hay neo", async () => {
    for (const lech of ["https://examplebucket.s3.amazonaws.com/?lifecycle", "https://examplebucket.s3.amazonaws.com/test.txt#x"]) {
      await expect(signRequest({ method: "GET", url: new URL(lech), headers: {}, payloadHash: EMPTY_SHA256 }, AWS, NGAY_MAU)).rejects.toThrow("query");
    }
  });
});
