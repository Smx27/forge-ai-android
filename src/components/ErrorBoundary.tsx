import React from 'react';
import {ScrollView} from 'react-native';
import {AlertTriangle} from 'lucide-react-native';
import {YStack} from '@tamagui/stacks';
import {Button, Card, IconTile, Text} from '../ui';

function Fallback({error, onReset}: {error: Error; onReset: () => void}) {
  return (
    <YStack flex={1} backgroundColor="$bg" padding="$6" justifyContent="center">
      <IconTile icon={AlertTriangle} tone="danger" size={48} />
      <Text variant="title" marginTop="$4">Something broke on this screen</Text>
      <Text variant="small" tone="muted" marginTop="$2">Your chats and files are safe. Reload the screen to continue.</Text>
      <Card tone="sunken" marginTop="$4" padding="$3" maxHeight={160}>
        <ScrollView><Text variant="mono" tone="faint">{error.message}</Text></ScrollView>
      </Card>
      <Button title="Reload" onPress={onReset} style={{marginTop: 24}} />
    </YStack>
  );
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, {error: Error | null}> {
  state = {error: null as Error | null};
  static getDerivedStateFromError(error: Error) { return {error}; }
  render() {
    if (this.state.error) return <Fallback error={this.state.error} onReset={() => this.setState({error: null})} />;
    return this.props.children;
  }
}
