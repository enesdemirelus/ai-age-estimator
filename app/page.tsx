"use client";
import { Container, Title, Text, Stack, Button, Modal } from "@mantine/core";
import { IconUpload, IconPhoto, IconX } from "@tabler/icons-react";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import * as faceapi from "face-api.js";
import { useDisclosure } from "@mantine/hooks";
import axios from "axios";
import { Progress } from "@mantine/core";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [detections, setDetections] = useState<faceapi.FaceDetection[]>([]);
  const [faceThumbnails, setFaceThumbnails] = useState<string[]>([]);
  const [hoveredFaceIndex, setHoveredFaceIndex] = useState<number | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [modalOpened, { open, close }] = useDisclosure(false);
  const [age, setAge] = useState<number | null>(null);
  const [isFaceSelected, setIsFaceSelected] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    faceapi.nets.tinyFaceDetector
      .loadFromUri("/models")
      .then(() => {
        setModelsLoaded(true);
        setStatus("Models loaded. You can now detect faces.");
      })
      .catch((error) => {
        console.error("Error loading face-api models:", error);
        setStatus("Failed to load models. Check console for details.");
      });
  }, []);

  const handleDrop = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setDetections([]);
      setStatus("");
      setFaceThumbnails([]);
      setHoveredFaceIndex(null);
      setAge(null);
      setIsFaceSelected(false);
      setIsEstimating(false);
      setProgress(0);
    }
  };

  const cropFace = async (box: any) => {
    if (!imageRef.current) return null;

    const img = imageRef.current;

    const canvas = document.createElement("canvas");
    canvas.width = box.width;
    canvas.height = box.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(
      img,
      box.x,
      box.y,
      box.width,
      box.height,
      0,
      0,
      box.width,
      box.height
    );

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg");
    });
  };

  const handleFindFace = async () => {
    if (!file) {
      setStatus("Please upload an image first.");
      return;
    }

    if (!modelsLoaded) {
      setStatus("Loading models, please wait...");
    }

    if (!imageRef.current) {
      setStatus("Image is not ready yet. Please wait a moment.");
      return;
    }

    setStatus("detecting faces ...");

    try {
      const results = await faceapi.detectAllFaces(
        imageRef.current,
        new faceapi.TinyFaceDetectorOptions()
      );

      setDetections(results);

      if (results.length === 0) {
        setStatus("No faces detected in this image.");
      } else if (results.length === 1) {
        setStatus("Detected 1 face.");
      } else {
        setStatus(`Detected ${results.length} faces in this image.`);
      }
      console.log("Face detections:", results);
      if (results.length > 0) {
        const blobs = await Promise.all(
          results.map((result) => cropFace(result.box))
        );
        const urls = blobs
          .map((blob) => (blob ? URL.createObjectURL(blob) : null))
          .filter((url): url is string => url !== null);
        setFaceThumbnails(urls);
        setHoveredFaceIndex(null);
        open();
      }
    } catch (error) {
      console.error("Error detecting faces:", error);
      setStatus("Error detecting faces. Check console for details.");
    }
  };

  const handleEstimateAge = async (faceIndex: number) => {
    if (!imageRef.current) {
      setStatus("Image is not ready yet. Please wait a moment.");
      return;
    }

    const detection = detections[faceIndex];
    if (!detection) {
      setStatus("Could not find the selected face.");
      setIsFaceSelected(false);
      return;
    }

    try {
      const croppedBlob = await cropFace(detection.box);
      if (!croppedBlob) {
        setStatus("Failed to crop the selected face.");
        return;
      }

      const formData = new FormData();
      const croppedFile = new File([croppedBlob], "image.jpg", {
        type: "image/jpeg",
      });
      formData.append("image", croppedFile);

      const response = await axios.post("/api/predict", formData);
      const predictedAge = Math.round(response.data.age);
      setAge(predictedAge);
      console.log("Predicted age:", predictedAge);
    } catch (error) {
      console.error("Error estimating age:", error);
      setStatus("Error estimating age. Check console for details.");
    }
  };
  return (
    <>
      <Modal
        opened={modalOpened}
        onClose={close}
        title="Please select the face:"
      >
        {faceThumbnails.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              justifyContent: "center",
              padding: "0.5rem",
            }}
          >
            {faceThumbnails.map((url, index) => {
              const isHovered = index === hoveredFaceIndex;

              return (
                <div
                  key={index}
                  onClick={() => {
                    setStatus(`Selected face ${index + 1}`);
                    setIsFaceSelected(true);
                    setAge(null);
                    setProgress(0);
                    setIsEstimating(true);

                    const duration = 4000;
                    const steps = 40;
                    const stepDuration = duration / steps;
                    let current = 0;

                    const interval = setInterval(() => {
                      current += 100 / steps;
                      setProgress(() => {
                        const next = Math.min(100, current);
                        return next;
                      });
                      if (current >= 100) {
                        clearInterval(interval);
                      }
                    }, stepDuration);

                    setTimeout(() => {
                      setIsEstimating(false);
                    }, duration);

                    handleEstimateAge(index);
                  }}
                  onMouseEnter={() => setHoveredFaceIndex(index)}
                  onMouseLeave={() => setHoveredFaceIndex(null)}
                  style={{
                    border: isHovered
                      ? "2px solid #ffa372"
                      : "2px solid #e0e0e0",
                    borderRadius: "10px",
                    padding: "4px",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    outline: "none",
                    boxShadow: isHovered
                      ? "0 4px 10px rgba(0, 0, 0, 0.12)"
                      : "0 1px 3px rgba(0, 0, 0, 0.08)",
                    transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                    transition:
                      "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
                  }}
                >
                  <div
                    style={{
                      width: "110px",
                      height: "110px",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={url}
                      alt={`Detected face ${index + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Text size="sm">No faces to show.</Text>
        )}
        {!isFaceSelected && (
          <Text size="sm" c="orange">
            You can't see your face? Try uploading a clearer picture.
          </Text>
        )}
        {isFaceSelected && isEstimating && (
          <Progress color="orange" value={progress} striped animated />
        )}
        {isFaceSelected && !isEstimating && age !== null && (
          <Text size="lg" fw={600} c="orange" mt="sm" ta="center">
            Estimated age: {age}
          </Text>
        )}
      </Modal>
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "#fffcf7",
        }}
      >
        <Container size="lg" style={{ maxWidth: "800px", width: "100%" }}>
          <Stack gap="xl" align="center">
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <Title
                order={1}
                style={{
                  fontSize: "3rem",
                  fontWeight: 700,
                  color: "#ff6b35",
                  marginBottom: "0.5rem",
                  letterSpacing: "-0.02em",
                }}
              >
                AI Age Estimator
              </Title>
              <Text
                size="lg"
                style={{
                  color: "#e55a2b",
                  fontSize: "1.125rem",
                  fontWeight: 500,
                }}
              >
                Upload a photo and let our AI estimate the age instantly.
              </Text>
            </div>

            <div style={{ width: "100%", maxWidth: "700px" }}>
              <Dropzone
                onDrop={handleDrop}
                onReject={(files) => console.log("rejected file", files)}
                maxSize={5 * 1024 ** 2}
                maxFiles={1}
                accept={IMAGE_MIME_TYPE}
                style={{
                  border: "2px solid #ff6b35",
                  borderRadius: "16px",
                  padding: "3rem 2rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  backgroundColor: "#ffffff",
                }}
                styles={{
                  root: {
                    "&:hover": {
                      backgroundColor: "#fff4e6",
                      borderColor: "#e55a2b",
                    },
                  },
                }}
              >
                {file ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "400px",
                        height: "400px",
                        borderRadius: "8px",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        ref={imageRef}
                        src={URL.createObjectURL(file)}
                        alt="Uploaded"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <Stack
                    align="center"
                    gap="lg"
                    style={{ pointerEvents: "none" }}
                  >
                    <Dropzone.Accept>
                      <IconUpload size={64} color="#ff6b35" stroke={1.5} />
                    </Dropzone.Accept>
                    <Dropzone.Reject>
                      <IconX size={64} color="#fa5252" stroke={1.5} />
                    </Dropzone.Reject>
                    <Dropzone.Idle>
                      <IconPhoto size={64} color="#ff6b35" stroke={1.5} />
                    </Dropzone.Idle>

                    <div style={{ textAlign: "center" }}>
                      <Text
                        size="xl"
                        fw={600}
                        style={{
                          color: "#ff6b35",
                          marginBottom: "0.5rem",
                          fontSize: "1.25rem",
                        }}
                      >
                        Drop your photo here
                      </Text>
                      <Text
                        size="sm"
                        style={{
                          color: "#e55a2b",
                          fontSize: "0.95rem",
                        }}
                      >
                        or click to browse
                      </Text>
                    </div>
                  </Stack>
                )}
              </Dropzone>
            </div>
            <Button
              variant="filled"
              color="orange"
              h={40}
              fz={15}
              w={200}
              onClick={handleFindFace}
            >
              Estimate Age
            </Button>
          </Stack>
        </Container>
      </div>
    </>
  );
}
