import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/theme/tokens';
import { AppBar, Body } from '@/components/Chrome';
import { Button } from '@/components/Button';
import { Field, Control } from '@/components/Field';
import { Sheet, Switch } from '@/components/Overlays';
import { useAdminPlans, useSavePlan } from '@/data/api/queries';
import type { ApiPlanRow } from '@/data/api/api';
import { formatMoney } from '@/data/format';

export default function Plans() {
  const { role, darkMode } = useApp();
  const c = useColors(darkMode);
  const router = useRouter();
  const plans = useAdminPlans();
  const save = useSavePlan();
  const [editing, setEditing] = React.useState<ApiPlanRow | 'new' | null>(null);
  const [name, setName] = React.useState('');
  const [months, setMonths] = React.useState('1');
  const [price, setPrice] = React.useState('');
  const [active, setActive] = React.useState(true);
  const [error, setError] = React.useState('');
  if (role !== 'admin') return <Redirect href="/welcome" />;
  const edit = (row: ApiPlanRow | 'new') => {
    setEditing(row); setError(''); save.reset();
    setName(row === 'new' ? '' : row.name); setMonths(row === 'new' ? '1' : String(row.duration_months));
    setPrice(row === 'new' ? '' : String(row.price)); setActive(row === 'new' ? true : row.is_active);
  };
  const submit = async () => {
    if (save.isPending) return;
    if (!name.trim() || !/^\d+$/.test(months) || Number(months) < 1 || Number(months) > 120 || !/^\d+(\.\d{1,2})?$/.test(price)) {
      setError('Enter a name, 1–120 months and a valid price.'); return;
    }
    try {
      await save.mutateAsync({ id: editing && editing !== 'new' ? editing.id : undefined, name: name.trim(), months: Number(months), price: Number(price), active });
      setEditing(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this plan.'); }
  };
  return <View style={{ flex: 1, backgroundColor: c.bg }}>
    <AppBar title="Membership plans" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <Body style={{ gap: 16 }}>
        <Text style={{ color: c.ink2, fontSize: 15, lineHeight: 22 }}>Set your club’s prices and terms. Changes apply to future memberships.</Text>
        {plans.isError ? <Text accessibilityRole="alert" style={{color:c.bad}}>Plans could not be loaded. Please retry.</Text> : null}
        {(plans.data ?? []).map(row => <View key={row.id} style={{ padding: 16, gap: 12, borderWidth: 1, borderColor:c.line, borderRadius:16, backgroundColor:c.bg1 }}>
          <View style={{flexDirection:'row',gap:12,alignItems:'center'}}>
            <View style={{flex:1,minWidth:0}}><Text style={{color:c.ink,fontSize:15,fontWeight:'600'}}>{row.name}</Text><Text style={{color:c.ink2,fontSize:13,lineHeight:20,marginTop:4}}>{row.duration_months} months · {formatMoney(Number(row.price),row.currency)}{row.is_active ? '' : ' · Inactive'}</Text></View>
            <Button size="sm" variant="secondary" onPress={() => edit(row)}>Edit</Button>
          </View>
        </View>)}
        <Button block onPress={() => edit('new')}>Create plan</Button>
      </Body>
    </ScrollView>
    <Sheet visible={editing !== null} onClose={() => { if (!save.isPending) setEditing(null); }} title={editing === 'new' ? 'Create plan' : 'Edit plan'}>
      <View style={{gap:14,marginTop:12}}>
        <Field label="Plan name"><Control accessibilityLabel="Plan name" value={name} onChangeText={setName} placeholder="Six-month membership" maxLength={120} /></Field>
        <Field label="Term in months"><Control accessibilityLabel="Term in months" value={months} onChangeText={setMonths} inputMode="numeric" maxLength={3} /></Field>
        <Field label="Price"><Control accessibilityLabel="Plan price" value={price} onChangeText={setPrice} inputMode="decimal" /></Field>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:c.ink}}>Available for new memberships</Text><Switch on={active} onChange={setActive} /></View>
        {error ? <Text accessibilityRole="alert" style={{color:c.bad,lineHeight:20}}>{error}</Text> : null}
        <Button block loading={save.isPending} onPress={submit}>Save plan</Button>
      </View>
    </Sheet>
  </View>;
}
