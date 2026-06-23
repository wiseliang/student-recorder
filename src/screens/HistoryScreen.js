import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { get } from '../utils/api'

const TYPE_NAMES = { companion: '录入陪伴', talk: '录入谈话', batch: '一键录入', 'fill-missing': '补录缺失' }

export default function HistoryScreen({ navigation }) {
  const [items, setItems] = useState([])

  useFocusEffect(useCallback(() => {
    get('/api/history', { page: 1, pageSize: 50 }).then(r => setItems(r.items)).catch(() => {})
  }, []))

  return (
    <View style={styles.container}>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>暂无录入记录</Text>
          <Text style={styles.emptyHint}>完成一次录入后这里会显示记录</Text>
        </View>
      ) : (
        <FlatList data={items} keyExtractor={i => i.taskUuid}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.item}
              onPress={() => navigation.navigate('Result', { taskUuid: item.taskUuid })}>
              <View>
                <Text style={styles.itemWeek}>第{item.week}周</Text>
                <Text style={styles.itemType}>{TYPE_NAMES[item.type] || item.type}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemResult}>✅ {item.success} / {item.total}</Text>
                <Text style={styles.itemDate}>{item.createdAt?.slice(0, 10)}</Text>
              </View>
            </TouchableOpacity>
          )} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 8, borderRadius: 12, padding: 16 },
  itemWeek: { fontSize: 16, fontWeight: '600' },
  itemType: { fontSize: 13, color: '#999', marginTop: 2 },
  itemRight: { alignItems: 'flex-end' },
  itemResult: { color: '#52C41A', fontWeight: '600', fontSize: 15 },
  itemDate: { color: '#ccc', fontSize: 11, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { color: '#999', fontSize: 16 },
  emptyHint: { fontSize: 13, color: '#ccc', marginTop: 4 },
})
