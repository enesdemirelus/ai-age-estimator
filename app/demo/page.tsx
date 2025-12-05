"use client";
import { Button, FileButton, Text } from "@mantine/core";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import * as faceapi from "face-api.js";
import axios from "axios";

function page() {
  const [file, setFile] = useState<File | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [croppedImageUrl, setCroppedImageUrl] = useState("");
  const [croppedImageBlob, setCroppedImageBlob] = useState<Blob | null>(null);
  const [detections, setDetections] = useState<faceapi.FaceDetection[]>([]);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

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

  const handleFileChange = (uploadedFile: File | null) => {
    setFile(uploadedFile);
    setDetections([]);
    setStatus("");
    setCroppedImageUrl("");
    setCroppedImageBlob(null);
    setAge(null);
  };

  const handleSubmit = async () => {
    if (!croppedImageBlob) {
      return alert("Please select an image and detect a face first");
    }

    setLoading(true);

    try {
      const formData = new FormData();
      const file = new File([croppedImageBlob], "image.jpg", {
        type: "image/jpeg",
      });
      formData.append("image", file);

      const response = await axios.post("/api/predict", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setAge(response.data.age);
    } catch (err) {
      console.error(err);
      alert("Failed to predict age");
    } finally {
      setLoading(false);
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
        setStatus(`Detected ${results.length} faces.`);
      }
      console.log("Face detections:", results);
      const faceBox = results[0].box;
      const croppedBlob = await cropFace(faceBox);
      if (croppedBlob) {
        const newFaceURL = URL.createObjectURL(croppedBlob);
        setCroppedImageUrl(newFaceURL);
        setCroppedImageBlob(croppedBlob);
      }
    } catch (error) {
      console.error("Error detecting faces:", error);
      setStatus("Error detecting faces. Check console for details.");
    }
  };

  return (
    <div className="flex flex-col gap-3 w-50 m-5">
      <FileButton onChange={handleFileChange} accept="image/png,image/jpeg">
        {(props) => <Button {...props}>Upload image</Button>}
      </FileButton>

      <Button onClick={handleFindFace} disabled={!file}>
        Find the face
      </Button>

      <Button onClick={handleSubmit} disabled={!file}>
        Predict the age
      </Button>

      {file && (
        <div
          style={{
            position: "relative",
            display: "inline-block",
            marginTop: "0.75rem",
          }}
        >
          <img
            ref={imageRef}
            src={URL.createObjectURL(file)}
            alt="Uploaded"
            style={{
              display: "block",
              maxWidth: "480px",
              width: "100%",
              height: "auto",
              objectFit: "contain",
            }}
          />

          {detections.map((det, index) => {
            const imgEl = imageRef.current;
            if (!imgEl) return null;

            const { x, y, width, height } = det.box;

            const scaleX = imgEl.width / imgEl.naturalWidth;
            const scaleY = imgEl.height / imgEl.naturalHeight;

            return (
              <div
                key={index}
                style={{
                  position: "absolute",
                  border: "3px solid #ff6b35",
                  boxSizing: "border-box",
                  left: x * scaleX,
                  top: y * scaleY,
                  width: width * scaleX,
                  height: height * scaleY,
                  pointerEvents: "none",
                }}
              />
            );
          })}
        </div>
      )}

      {croppedImageUrl && (
        <img
          src={croppedImageUrl}
          alt="Cropped face"
          width={200}
          style={{ marginTop: "1rem", borderRadius: "6px" }}
        />
      )}

      {status && (
        <Text size="sm" mt="sm">
          {status}
        </Text>
      )}

      {age && (
        <Text size="sm" mt="sm">
          The age of the person in the image is {age}
        </Text>
      )}
    </div>
  );
}

export default page;
