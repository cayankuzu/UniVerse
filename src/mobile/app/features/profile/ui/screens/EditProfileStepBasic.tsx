import React from "react";
import { View } from "react-native";
import { tokens } from "../../../../shared/theme";
import { TextField } from "../../../../shared/components";

type Props = {
  errors: {
    clubName?: string;
    name?: string;
    username?: string;
  };
  isClub: boolean;
  username: string;
  usernameChecking?: boolean;
  displayName: string;
  onUsernameChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
};

export function EditProfileStepBasic({
  errors,
  isClub,
  username,
  usernameChecking = false,
  displayName,
  onUsernameChange,
  onDisplayNameChange,
}: Props) {
  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <TextField
        autoCapitalize="none"
        autoCorrect={false}
        errorText={errors.username}
        fieldName="username"
        isChecking={usernameChecking}
        label="Kullanıcı adı"
        onChangeText={onUsernameChange}
        placeholder="ornek_kullanici"
        supportingText="Profil bağlantında görünen benzersiz kullanıcı adı."
        value={username}
      />

      {isClub ? (
        <TextField
          fieldName="clubName"
          errorText={errors.clubName}
          label="Kulüp Adı"
          placeholder="Kulüp adınızı girin"
          value={displayName}
          onChangeText={onDisplayNameChange}
        />
      ) : (
        <TextField
          fieldName="name"
          errorText={errors.name}
          label="Ad Soyad"
          placeholder="Adınızı soyadınızı girin"
          value={displayName}
          onChangeText={onDisplayNameChange}
        />
      )}
    </View>
  );
}
