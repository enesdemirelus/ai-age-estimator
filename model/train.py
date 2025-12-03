import tensorflow as tf
from tensorflow.keras import layers, models, callbacks
from tensorflow.keras.preprocessing import image_dataset_from_directory

BATCH_SIZE = 32
IMG_SIZE = (200, 200)

train_ds = image_dataset_from_directory(
    "model/dataset/new-dataset",
    validation_split=0.2,
    subset="training",
    seed=123,
    image_size=IMG_SIZE
)

val_ds = image_dataset_from_directory(
    "model/dataset/new-dataset",
    validation_split=0.2,
    subset="validation",
    seed=123,
    image_size=IMG_SIZE
)

train_ds = train_ds.prefetch(tf.data.AUTOTUNE)
val_ds = val_ds.prefetch(tf.data.AUTOTUNE)

base_model = tf.keras.applications.MobileNetV2(
    input_shape=(200, 200, 3),
    include_top=False,
    weights='imagenet'
)

base_model.trainable = False

inputs = tf.keras.Input(shape=(200, 200, 3))
x = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)
x = layers.RandomFlip("horizontal")(x)
x = layers.RandomRotation(0.1)(x)
x = base_model(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.2)(x)
outputs = layers.Dense(1, activation='relu')(x)

model = tf.keras.Model(inputs, outputs)

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss='mean_absolute_error',
    metrics=['mean_absolute_error']
)

history = model.fit(
    train_ds,
    epochs=10,
    validation_data=val_ds
)

base_model.trainable = True
fine_tune_at = 100
for layer in base_model.layers[:fine_tune_at]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
    loss='mean_absolute_error',
    metrics=['mean_absolute_error']
)

history_fine = model.fit(
    train_ds,
    epochs=20,
    initial_epoch=history.epoch[-1],
    validation_data=val_ds,
    callbacks=[callbacks.EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)]
)

model.save("age-transfer-model.keras")
