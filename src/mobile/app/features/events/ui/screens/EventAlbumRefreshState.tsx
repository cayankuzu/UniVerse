import React from "react";
import { FlatList, View } from "react-native";
import { EmptyState } from "../../../../shared/components";
import { tokens } from "../../../../shared/theme";

type Props = {
  children?: React.ReactNode;
  onRefresh: () => void;
  refreshing: boolean;
  subtitle: string;
  title: string;
};

export function EventAlbumRefreshState({
  children,
  onRefresh,
  refreshing,
  subtitle,
  title,
}: Props) {
  return (
    <FlatList
      data={[] as string[]}
      keyExtractor={(item) => item}
      refreshing={refreshing}
      onRefresh={onRefresh}
      progressViewOffset={12}
      style={{ flex: 1 }}
      alwaysBounceVertical
      overScrollMode="always"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        paddingBottom: tokens.spacing.xxl,
      }}
      renderItem={() => null}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: tokens.spacing.md }}>
          <EmptyState title={title} subtitle={subtitle} />
          {children}
        </View>
      }
    />
  );
}
