import tensorflow as tf

model = tf.keras.models.load_model("age-transfer-model.keras")

model.export("saved_model")
