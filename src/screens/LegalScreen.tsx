import React from 'react';
import {ScrollView} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {ArrowLeft} from 'lucide-react-native';
import type {RootStackParamList} from '../navigation/types';
import {NavHeader, Screen} from '../ui';
import {Markdown} from '../components/Markdown';
import {LEGAL} from '../legal';

export default function LegalScreen() {
  const navigation = useNavigation();
  const {params} = useRoute<RouteProp<RootStackParamList, 'Legal'>>();
  const doc = LEGAL[params.doc];
  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title={doc.title} backIcon={ArrowLeft} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{padding: 16, paddingBottom: 48}}><Markdown text={doc.body} /></ScrollView>
    </Screen>
  );
}
